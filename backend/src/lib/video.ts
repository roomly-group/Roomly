import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";

// Removes everything a video file carries besides its picture and sound:
// metadata (GPS position, device model, recording date), chapters, and any
// extra data track (iPhones store location in one). The streams are copied,
// not re-encoded, so it takes a fraction of a second and loses no quality.

// ===================== CONFIGURATION =====================

/** Longest time ffmpeg may run on one upload before it is stopped (ms). */
const FFMPEG_TIMEOUT_MS = 30_000 as const;

/** Container name ffmpeg writes for each stored extension. */
const OUTPUT_FORMATS = { webm: "webm", mp4: "mp4", mov: "mov" } as const;

export type VideoExtension = keyof typeof OUTPUT_FORMATS;

/** The video could not be read or cleaned. */
export class VideoProcessingError extends Error {}

/** Runs ffmpeg with fixed arguments (no shell); rejects on a non-zero exit or timeout. */
function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new VideoProcessingError("ffmpeg binary not available"));
      return;
    }
    const child = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      // Keep only the tail: it holds the error line.
      stderr = (stderr + chunk.toString()).slice(-2000);
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), FFMPEG_TIMEOUT_MS);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new VideoProcessingError(err.message));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new VideoProcessingError(`ffmpeg exited with ${code}: ${stderr.trim().split("\n").pop() ?? ""}`));
    });
  });
}

/** A copy of the video with only its video and audio streams, and no metadata. */
export async function stripVideoMetadata(video: Buffer, extension: VideoExtension): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "roomly-video-"));
  const input = join(dir, `${randomUUID()}-in.${extension}`);
  const output = join(dir, `${randomUUID()}-out.${extension}`);
  try {
    await writeFile(input, video);
    await runFfmpeg([
      "-hide_banner",
      "-loglevel", "error",
      "-i", input,
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
    return await readFile(output);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
