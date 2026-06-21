import { execFile, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { DEFAULT_CONCURRENCY, mapWithConcurrency } from "./concurrency.js";
import { parseOffsetString } from "./offset.js";

const execFileAsync = promisify(execFile);

const EXIF_TAG_ARGS = [
  "-n",
  "-GPSLatitude",
  "-GPSLongitude",
  "-OffsetTimeOriginal",
  "-OffsetTime",
  "-OffsetTimeDigitized",
  "-SubSecDateTimeOriginal",
  "-DateTimeOriginal",
  "-ContentCreateDate",
  "-CreateDate",
];

const EXIF_BATCH_SIZE = 25;

let exifCache = null;
let exifCacheUsers = 0;

export async function withExifCache(fn) {
  if (!exifCache) {
    exifCache = new Map();
  }
  exifCacheUsers += 1;

  try {
    return await fn();
  } finally {
    exifCacheUsers -= 1;
    if (exifCacheUsers === 0) {
      exifCache = null;
    }
  }
}

function runExiftool(mediaPath, args) {
  if (!existsSync(mediaPath)) {
    return null;
  }

  try {
    const output = execFileSync("exiftool", ["-j", ...args, mediaPath], {
      encoding: "utf8",
    });

    return JSON.parse(output)[0] ?? null;
  } catch {
    return null;
  }
}

function storeExifRows(rows) {
  if (!exifCache) {
    return;
  }

  for (const row of rows) {
    const { SourceFile, ...tags } = row;
    exifCache.set(SourceFile, tags);
  }
}

async function preloadExifChunk(existingPaths) {
  try {
    const { stdout } = await execFileAsync(
      "exiftool",
      ["-j", ...EXIF_TAG_ARGS, ...existingPaths],
      { maxBuffer: 64 * 1024 * 1024 },
    );

    storeExifRows(JSON.parse(stdout));
  } catch {
    await mapWithConcurrency(
      existingPaths,
      async (mediaPath) => {
        if (!exifCache?.has(mediaPath)) {
          exifCache?.set(mediaPath, runExiftool(mediaPath, EXIF_TAG_ARGS));
        }
      },
      DEFAULT_CONCURRENCY,
    );
  }
}

export async function preloadExifTags(mediaPaths, {
  concurrency = DEFAULT_CONCURRENCY,
} = {}) {
  if (!exifCache) {
    return;
  }

  const chunks = [];
  for (let index = 0; index < mediaPaths.length; index += EXIF_BATCH_SIZE) {
    const existingPaths = mediaPaths
      .slice(index, index + EXIF_BATCH_SIZE)
      .filter((mediaPath) => existsSync(mediaPath));

    if (existingPaths.length > 0) {
      chunks.push(existingPaths);
    }
  }

  await mapWithConcurrency(chunks, preloadExifChunk, concurrency);
}

export function readExifTags(mediaPath) {
  if (exifCache?.has(mediaPath)) {
    return exifCache.get(mediaPath);
  }

  const result = runExiftool(mediaPath, EXIF_TAG_ARGS);
  exifCache?.set(mediaPath, result);
  return result;
}

export function extractOffsetFromExif(exif) {
  if (!exif) {
    return null;
  }

  for (const key of ["OffsetTimeOriginal", "OffsetTime", "OffsetTimeDigitized"]) {
    const offsetMinutes = parseOffsetString(exif[key]);
    if (offsetMinutes != null) {
      return offsetMinutes;
    }
  }

  const subsec = exif.SubSecDateTimeOriginal;
  if (subsec) {
    const match = String(subsec).match(/([+-]\d{2}:\d{2})$/);
    if (match) {
      return parseOffsetString(match[1]);
    }
  }

  return null;
}

export function getExifPhotoTakenDatetime(exif) {
  if (!exif) {
    return null;
  }

  if (exif.SubSecDateTimeOriginal) {
    return exif.SubSecDateTimeOriginal;
  }

  if (exif.DateTimeOriginal) {
    const offset = exif.OffsetTimeOriginal ?? exif.OffsetTime;
    return offset ? `${exif.DateTimeOriginal}${offset}` : exif.DateTimeOriginal;
  }

  if (exif.ContentCreateDate) {
    return exif.ContentCreateDate;
  }

  if (exif.CreateDate) {
    return exif.CreateDate;
  }

  return null;
}

export function getExifMinutesSeconds(mediaPath) {
  const exif = readExifTags(mediaPath);
  const value = getExifPhotoTakenDatetime(exif);
  if (!value) {
    return null;
  }

  const match = String(value).match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (!match) {
    return null;
  }

  return {
    minute: Number(match[5]),
    second: Number(match[6]),
  };
}
