import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import { VERIFICATION_VIDEO_MAX_SECONDS } from "@workspace/api-zod";

// Removes everything a video file carries besides its picture and sound:
// metadata (GPS position, device model, recording date), chapters, and any
// extra data track (iPhones store location in one). The streams are copied,
// not re-encoded, so it takes a fraction of a second and loses no quality.
//
// The file comes from the user, so ffmpeg is hardened (RMY-19):
// - the input format is forced to the one the upload claimed and passed the
//   signature check (no format guessing: a file posing as a video cannot be
//   read by some other, riskier demuxer);
// - only the local "file" protocol is allowed, so a crafted file (e.g. a
//   playlist) can never make ffmpeg open URLs or other files;
// - the length is measured while copying, and the copy stops just past the
//   limit, so a long video costs no more work than a valid one.

// ===================== CONFIGURATION =====================

/** Longest time ffmpeg may run on one upload before it is stopped (ms). */
const FFMPEG_TIMEOUT_MS = 30_000 as const;

/** Container name ffmpeg writes for each stored extension. */
const OUTPUT_FORMATS = { webm: "webm", mp4: "mp4", mov: "mov" } as const;

/** Demuxer forced for each extension (ffmpeg's "matroska" also reads WebM; "mov" reads MP4 and MOV). */
const INPUT_FORMATS = { webm: "matroska", mp4: "mov", mov: "mov" } as const;

/** The only protocol ffmpeg may use: the temporary input file on disk. */
const FFMPEG_PROTOCOL_WHITELIST = "file" as const;

/**
 * Extra seconds accepted past VERIFICATION_VIDEO_MAX_SECONDS: the recorder
 * stops on a 1-second timer, so a full recording can be slightly longer.
 */
const VIDEO_DURATION_GRACE_SECONDS = 2 as const;
/** Longest video accepted (seconds). */
const VIDEO_MAX_ACCEPTED_SECONDS = VERIFICATION_VIDEO_MAX_SECONDS + VIDEO_DURATION_GRACE_SECONDS;
/** The copy stops here: anything that reaches it is too long. */
const VIDEO_COPY_LIMIT_SECONDS = VIDEO_MAX_ACCEPTED_SECONDS + 1;

/** Line of ffmpeg's progress report holding how much has been written (microseconds). */
const PROGRESS_OUT_TIME_PATTERN = /out_time_us=(\d+)/g;
/** Characters of ffmpeg's output kept: enough for the last progress report and error line. */
const FFMPEG_OUTPUT_TAIL_CHARS = 4000 as const;

export type VideoExtension = keyof typeof OUTPUT_FORMATS;

/** The video could not be read or cleaned. */
export class VideoProcessingError extends Error {}

/** The video is longer than the verification allows (RMY-19). */
export class VideoTooLongError extends VideoProcessingError {}

/** Length of the copied video from ffmpeg's last progress report, in seconds; null if none. */
function durationFromProgress(output: string): number | null {
  const matches = [...output.matchAll(PROGRESS_OUT_TIME_PATTERN)];
  const last = matches.at(-1)?.[1];
  return last === undefined ? null : Number(last) / 1_000_000;
}

/** Runs ffmpeg with fixed arguments (no shell); resolves with the tail of its output, rejects on a non-zero exit or timeout. */
function runFfmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new VideoProcessingError("ffmpeg binary not available"));
      return;
    }
    const child = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      // Keep only the tail: it holds the last progress report and the error line.
      stderr = (stderr + chunk.toString()).slice(-FFMPEG_OUTPUT_TAIL_CHARS);
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), FFMPEG_TIMEOUT_MS);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new VideoProcessingError(err.message));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stderr);
      else {
        // The error line is the last one that is not part of a progress report (key=value).
        const errorLine = stderr.trim().split("\n").filter((line) => !/^\w+=/.test(line)).pop() ?? "";
        reject(new VideoProcessingError(`ffmpeg exited with ${code}: ${errorLine}`));
      }
    });
  });
}

/**
 * A copy of the video with only its video and audio streams, and no metadata.
 * Throws VideoTooLongError past the allowed length, VideoProcessingError when
 * the file cannot be read or its length cannot be measured.
 */
export async function stripVideoMetadata(video: Buffer, extension: VideoExtension): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "roomly-video-"));
  const input = join(dir, `${randomUUID()}-in.${extension}`);
  const output = join(dir, `${randomUUID()}-out.${extension}`);
  try {
    await writeFile(input, video);
    const report = await runFfmpeg([
      "-hide_banner",
      "-loglevel", "error",
      // Progress report (key=value lines) on stderr: gives the copied length,
      // also for browser WebM recordings whose header has no duration.
      "-nostats",
      "-progress", "pipe:2",
      // Input hardening (RMY-19): local file only, format fixed by the upload type.
      "-protocol_whitelist", FFMPEG_PROTOCOL_WHITELIST,
      "-f", INPUT_FORMATS[extension],
      "-i", input,
      // Stop copying just past the limit: a longer video is refused below.
      "-t", String(VIDEO_COPY_LIMIT_SECONDS),
      // Picture and sound only: drops data tracks such as the iPhone location track.
      "-map", "0:v?",
      "-map", "0:a?",
      "-map_metadata", "-1",
      "-map_chapters", "-1",
      "-c", "copy",
      ...(extension === "webm" ? [] : ["-movflags", "+faststart"]),
      "-f", OUTPUT_FORMATS[extension],
      "-y", output,
    ]);

    // Fail closed: a video whose length cannot be measured is not accepted.
    const seconds = durationFromProgress(report);
    if (seconds === null || !Number.isFinite(seconds)) {
      throw new VideoProcessingError("Video length could not be measured");
    }
    if (seconds > VIDEO_MAX_ACCEPTED_SECONDS) {
      throw new VideoTooLongError(`Video is longer than ${VIDEO_MAX_ACCEPTED_SECONDS} s`);
    }
    return await readFile(output);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
