import sharp from "sharp";

// ===================== CONFIGURATION =====================

/** Largest decoded image accepted (pixels): a small file must not unpack into a huge bitmap. */
const MAX_INPUT_PIXELS = 40_000_000 as const;
/** Quality of the JPEG written for every stored photo (1-100). */
const STORED_JPEG_QUALITY = 86 as const;

/** Image types accepted for uploads (listing photos, profile photos). */
export type UploadImageType = "image/png" | "image/jpeg";

/** How a re-encoded photo is sized: `cover` crops to fill the box, `inside` only shrinks to fit. */
export type PhotoBox = { width: number; height: number; fit: "cover" | "inside" };

/**
 * Decodes the upload and writes a brand-new JPEG from its pixels alone, so
 * nothing else the file carried reaches storage: metadata (EXIF GPS position
 * included), comments, extra chunks, or a script hidden in a "polyglot" file
 * that is also a valid JPEG/PNG. Throws when the bytes are not a decodable image.
 * Run isValidImage first: it is cheaper and rejects the obvious cases.
 */
export async function reencodeAsJpeg(file: Buffer, box: PhotoBox): Promise<Buffer> {
  return sharp(file, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
    .rotate() // apply the EXIF orientation before the metadata is dropped
    .resize({ ...box, withoutEnlargement: true })
    .flatten({ background: "#ffffff" }) // PNG transparency becomes white
    .jpeg({ quality: STORED_JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}

/** Normalised Content-Type of an upload, or null when it is not PNG/JPEG. */
export function uploadImageType(contentTypeHeader: string | undefined): UploadImageType | null {
  const contentType = contentTypeHeader?.split(";")[0].trim().toLowerCase();
  return contentType === "image/png" || contentType === "image/jpeg" ? contentType : null;
}

/**
 * True when the bytes really are a complete PNG or JPEG of the declared type:
 * checks the signature and that the file ends where the format says it should,
 * so a renamed or truncated file is rejected.
 */
export function isValidImage(file: Buffer, contentType: UploadImageType): boolean {
  if (contentType === "image/png") {
    if (!file.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false;
    let offset = 8;
    while (offset + 12 <= file.length) {
      const chunkLength = file.readUInt32BE(offset);
      const chunkEnd = offset + 12 + chunkLength;
      if (chunkEnd > file.length) return false;
      const chunkType = file.toString("ascii", offset + 4, offset + 8);
      if (chunkType === "IEND") return chunkLength === 0 && chunkEnd === file.length;
      offset = chunkEnd;
    }
    return false;
  }

  return file.length >= 4 &&
    file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff &&
    file[file.length - 2] === 0xff && file[file.length - 1] === 0xd9;
}
