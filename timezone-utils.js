import { execFile, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { find } from "geo-tz";
import { DEFAULT_CONCURRENCY, mapWithConcurrency } from "./lib/concurrency.js";

const execFileAsync = promisify(execFile);

const DATETIME_TITLE_RE = /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/;
const EXIF_DATETIME_RE =
  /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:([+-]\d{2}:\d{2}))?$/;
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function getCoords(data) {
  for (const key of ["geoData", "geoDataExif"]) {
    const geo = data[key];
    if (geo?.latitude != null && geo?.longitude != null) {
      const lat = geo.latitude;
      const lng = geo.longitude;
      if (lat !== 0 || lng !== 0) {
        return { lat, lng };
      }
    }
  }

  return null;
}

export function parseDatetimeFromTitle(title) {
  const match = title.match(DATETIME_TITLE_RE);
  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };
}

export function formatUtcOffset(offsetMinutes) {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;

  if (minutes === 0) {
    return `UTC${sign}${hours}`;
  }

  return `UTC${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function parseOffsetString(offset) {
  const match = String(offset).match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const sign = match[1] === "+" ? 1 : -1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

export function inferOffsetFromFilename(title, photoTakenTimestamp) {
  const local = parseDatetimeFromTitle(title);
  if (!local) {
    return null;
  }

  return inferOffsetFromLocalDateTime(local, photoTakenTimestamp);
}

function inferOffsetFromLocalDateTime(local, photoTakenTimestamp) {
  const localAsUtcMs = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  );
  const offsetMs = localAsUtcMs - photoTakenTimestamp * 1000;
  const offsetMinutes = Math.round(offsetMs / 60_000 / 15) * 15;

  if (Math.abs(offsetMinutes) > 14 * 60) {
    return null;
  }

  return offsetMinutes;
}

export function parseExifLocalDateTime(value) {
  const match = String(value).match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };
}

export function inferOffsetFromExifDateTime(dateTimeOriginal, photoTakenTimestamp) {
  const local = parseExifLocalDateTime(dateTimeOriginal);
  if (!local) {
    return null;
  }

  return inferOffsetFromLocalDateTime(local, photoTakenTimestamp);
}

export function getTimezoneFromCoords(lat, lng) {
  const timezones = find(lat, lng);
  return timezones[0] ?? null;
}

const EXIF_TAG_ARGS = [
  "-n",
  "-GPSLatitude",
  "-GPSLongitude",
  "-OffsetTimeOriginal",
  "-OffsetTime",
  "-OffsetTimeDigitized",
  "-SubSecDateTimeOriginal",
  "-DateTimeOriginal",
];

const EXIF_BATCH_SIZE = 25;

let exifCache = null;

export async function withExifCache(fn) {
  exifCache = new Map();
  try {
    return await fn();
  } finally {
    exifCache = null;
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
        if (!exifCache.has(mediaPath)) {
          exifCache.set(mediaPath, runExiftool(mediaPath, EXIF_TAG_ARGS));
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

export function resolveTimezoneFromCoordinates(data) {
  const coords = getCoords(data);
  if (!coords) {
    return null;
  }

  const timezone = getTimezoneFromCoords(coords.lat, coords.lng);
  if (!timezone) {
    return null;
  }

  return { timezone, source: "coordinates" };
}

export function resolveTimezoneFromFilename(data) {
  const photoTakenTimestamp = Number(data.photoTakenTime?.timestamp);
  if (!Number.isFinite(photoTakenTimestamp) || !data.title) {
    return null;
  }

  const offsetMinutes = inferOffsetFromFilename(data.title, photoTakenTimestamp);
  if (offsetMinutes == null) {
    return null;
  }

  return {
    timezone: formatUtcOffset(offsetMinutes),
    source: "filename",
    offsetMinutes,
  };
}

export function resolveTimezoneFromExif(mediaPath) {
  const exif = readExifTags(mediaPath);
  const offsetMinutes = extractOffsetFromExif(exif);
  if (offsetMinutes == null) {
    return null;
  }

  return {
    timezone: formatUtcOffset(offsetMinutes),
    source: "exif",
    offsetMinutes,
  };
}

export function resolveTimezoneFromExifDateTime(data, mediaPath) {
  const photoTakenTimestamp = Number(data.photoTakenTime?.timestamp);
  if (!Number.isFinite(photoTakenTimestamp)) {
    return null;
  }

  const exif = readExifTags(mediaPath);
  if (!exif?.DateTimeOriginal || extractOffsetFromExif(exif) != null) {
    return null;
  }

  const offsetMinutes = inferOffsetFromExifDateTime(
    exif.DateTimeOriginal,
    photoTakenTimestamp,
  );
  if (offsetMinutes == null) {
    return null;
  }

  return {
    timezone: formatUtcOffset(offsetMinutes),
    source: "exif-datetime",
    offsetMinutes,
  };
}

export function resolveTimezone(data, { mediaPath } = {}) {
  return (
    resolveTimezoneFromCoordinates(data) ??
    resolveTimezoneFromFilename(data) ??
    (mediaPath ? resolveTimezoneFromExif(mediaPath) : null) ??
    (mediaPath ? resolveTimezoneFromExifDateTime(data, mediaPath) : null)
  );
}

function formatTimezoneLine(result) {
  return result ? result.timezone : "not found";
}

function formatLocalTime(epochSeconds, timeZone, includeTimezone = true) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    ...(includeTimezone ? { timeZoneName: "short" } : {}),
  }).formatToParts(new Date(epochSeconds * 1000));

  const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
  const base = `${get("day")} ${get("month")} ${get("year")}, ${get("hour")}:${get("minute")}:${get("second")}`;

  if (!includeTimezone) {
    return base;
  }

  return `${base} ${get("timeZoneName")}`;
}

function formatLocalTimeWithOffset(epochSeconds, offsetMinutes, includeTimezone = true) {
  const date = new Date(epochSeconds * 1000 + offsetMinutes * 60_000);
  const base = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}, ${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}:${String(date.getUTCSeconds()).padStart(2, "0")}`;

  if (!includeTimezone) {
    return base;
  }

  return `${base} ${formatUtcOffset(offsetMinutes)}`;
}

function formatUtcTime(epochSeconds, includeTimezone = true) {
  const date = new Date(epochSeconds * 1000);
  const base = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}, ${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}:${String(date.getUTCSeconds()).padStart(2, "0")}`;

  if (!includeTimezone) {
    return base;
  }

  return `${base} UTC`;
}

function formatExifDatetimeString(value, includeTimezone = true) {
  const match = String(value).match(EXIF_DATETIME_RE);
  if (!match) {
    return value;
  }

  const [, year, month, day, hour, minute, second, offset] = match;
  const base = `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}, ${hour}:${minute}:${second}`;
  if (!offset || !includeTimezone) {
    return base;
  }

  const offsetMinutes = parseOffsetString(offset);
  return offsetMinutes == null ? `${base} ${offset}` : `${base} ${formatUtcOffset(offsetMinutes)}`;
}

function formatMetadataPhotoTime(data, timezones, includeTimezone = true) {
  const photoTakenTimestamp = Number(data.photoTakenTime?.timestamp);
  if (!Number.isFinite(photoTakenTimestamp)) {
    return "not found";
  }

  if (timezones.coordinates) {
    return formatLocalTime(
      photoTakenTimestamp,
      timezones.coordinates.timezone,
      includeTimezone,
    );
  }

  if (timezones.filename?.offsetMinutes != null) {
    return formatLocalTimeWithOffset(
      photoTakenTimestamp,
      timezones.filename.offsetMinutes,
      includeTimezone,
    );
  }

  if (timezones.exif?.offsetMinutes != null) {
    return formatLocalTimeWithOffset(
      photoTakenTimestamp,
      timezones.exif.offsetMinutes,
      includeTimezone,
    );
  }

  if (timezones.exifDatetime?.offsetMinutes != null) {
    return formatLocalTimeWithOffset(
      photoTakenTimestamp,
      timezones.exifDatetime.offsetMinutes,
      includeTimezone,
    );
  }

  return formatUtcTime(photoTakenTimestamp, includeTimezone);
}

function formatExifPhotoTime(mediaPath, includeTimezone = true) {
  const exif = readExifTags(mediaPath);
  if (!exif) {
    return "not found";
  }

  if (exif.SubSecDateTimeOriginal) {
    return formatExifDatetimeString(exif.SubSecDateTimeOriginal, includeTimezone);
  }

  if (exif.DateTimeOriginal) {
    const offset = exif.OffsetTimeOriginal ?? exif.OffsetTime;
    if (offset) {
      return formatExifDatetimeString(
        `${exif.DateTimeOriginal}${offset}`,
        includeTimezone,
      );
    }

    return formatExifDatetimeString(exif.DateTimeOriginal, includeTimezone);
  }

  return "not found";
}

function parseExifDatetimeToEpoch(value) {
  const match = String(value).match(EXIF_DATETIME_RE);
  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second, offsetStr] = match;
  const utcMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  const offsetMinutes = offsetStr ? parseOffsetString(offsetStr) : 0;
  if (offsetMinutes == null) {
    return null;
  }

  return Math.floor((utcMs - offsetMinutes * 60_000) / 1000);
}

export function getPhotoTakenEpochFromExif(mediaPath) {
  const exif = readExifTags(mediaPath);
  if (!exif) {
    return null;
  }

  if (exif.SubSecDateTimeOriginal) {
    const epoch = parseExifDatetimeToEpoch(exif.SubSecDateTimeOriginal);
    if (epoch != null) {
      return epoch;
    }
  }

  if (exif.DateTimeOriginal) {
    const offset = exif.OffsetTimeOriginal ?? exif.OffsetTime;
    const value = offset
      ? `${exif.DateTimeOriginal}${offset}`
      : exif.DateTimeOriginal;

    return parseExifDatetimeToEpoch(value);
  }

  return null;
}

export function getPhotoTakenEpoch(data, mediaPath) {
  const exifEpoch = mediaPath ? getPhotoTakenEpochFromExif(mediaPath) : null;
  if (exifEpoch != null) {
    return exifEpoch;
  }

  const metadataEpoch = Number(data?.photoTakenTime?.timestamp);
  if (Number.isFinite(metadataEpoch)) {
    return metadataEpoch;
  }

  return null;
}

function buildTimezoneSummary(coordinates, filename, exif, exifDatetime) {
  return {
    coordinates: coordinates?.timezone ?? null,
    filename: filename?.timezone ?? null,
    exif: exif?.timezone ?? null,
    exifDatetime: exifDatetime?.timezone ?? null,
  };
}

function getMetadataPhotoTimeTimezone(data, timezones) {
  const photoTakenTimestamp = Number(data.photoTakenTime?.timestamp);
  if (!Number.isFinite(photoTakenTimestamp)) {
    return null;
  }

  if (timezones.coordinates) {
    return { source: "coordinates", value: timezones.coordinates.timezone };
  }

  if (timezones.filename?.offsetMinutes != null) {
    return { source: "filename", value: timezones.filename.timezone };
  }

  if (timezones.exif?.offsetMinutes != null) {
    return { source: "exif", value: timezones.exif.timezone };
  }

  if (timezones.exifDatetime?.offsetMinutes != null) {
    return { source: "exif datetime", value: timezones.exifDatetime.timezone };
  }

  return null;
}

function getExifPhotoTimeTimezone(mediaPath) {
  const exif = readExifTags(mediaPath);
  if (!exif) {
    return null;
  }

  if (exif.SubSecDateTimeOriginal) {
    const match = String(exif.SubSecDateTimeOriginal).match(/([+-]\d{2}:\d{2})$/);
    if (match) {
      const offsetMinutes = parseOffsetString(match[1]);
      if (offsetMinutes != null) {
        return { source: "exif", value: formatUtcOffset(offsetMinutes) };
      }
    }
  }

  if (exif.DateTimeOriginal) {
    const offset = exif.OffsetTimeOriginal ?? exif.OffsetTime;
    if (offset) {
      const offsetMinutes = parseOffsetString(offset);
      if (offsetMinutes != null) {
        return { source: "exif", value: formatUtcOffset(offsetMinutes) };
      }
    }
  }

  return null;
}

function buildPhotoTakenSummary(data, mediaPath, timezones) {
  const metadataTime = formatMetadataPhotoTime(data, timezones, false);
  const exifTime = mediaPath ? formatExifPhotoTime(mediaPath, false) : null;

  return {
    metadata: metadataTime === "not found" ? null : metadataTime,
    metadataTimezone: getMetadataPhotoTimeTimezone(data, timezones),
    exif: exifTime === "not found" ? null : exifTime,
    exifTimezone: mediaPath ? getExifPhotoTimeTimezone(mediaPath) : null,
  };
}

export function analyzePhoto(data, { mediaPath } = {}) {
  const coordinates = resolveTimezoneFromCoordinates(data);
  const filename = resolveTimezoneFromFilename(data);
  const exif = mediaPath ? resolveTimezoneFromExif(mediaPath) : null;
  const exifDatetime = mediaPath
    ? resolveTimezoneFromExifDateTime(data, mediaPath)
    : null;
  const timezones = { coordinates, filename, exif, exifDatetime };

  return {
    timezones: buildTimezoneSummary(coordinates, filename, exif, exifDatetime),
    photoTaken: buildPhotoTakenSummary(data, mediaPath, timezones),
    photoTakenEpoch: getPhotoTakenEpoch(data, mediaPath),
  };
}

export function analyzeMediaFile(mediaPath) {
  const exif = resolveTimezoneFromExif(mediaPath);

  return {
    timezones: {
      coordinates: null,
      filename: null,
      exif: exif?.timezone ?? null,
      exifDatetime: null,
    },
    photoTaken: {
      metadata: null,
      metadataTimezone: null,
      exif: (() => {
        const value = formatExifPhotoTime(mediaPath, false);
        return value === "not found" ? null : value;
      })(),
      exifTimezone: getExifPhotoTimeTimezone(mediaPath),
    },
    photoTakenEpoch: getPhotoTakenEpochFromExif(mediaPath),
  };
}

export function describePhoto(data, { mediaPath } = {}) {
  const coordinates = resolveTimezoneFromCoordinates(data);
  const filename = resolveTimezoneFromFilename(data);
  const exif = mediaPath ? resolveTimezoneFromExif(mediaPath) : null;
  const exifDatetime = mediaPath
    ? resolveTimezoneFromExifDateTime(data, mediaPath)
    : null;
  const timezones = { coordinates, filename, exif, exifDatetime };

  return [
    `Timezone (coordinates): ${formatTimezoneLine(coordinates)}`,
    `Timezone (filename): ${formatTimezoneLine(filename)}`,
    `Timezone (exif): ${formatTimezoneLine(exif)}`,
    `Timezone (exif datetime): ${formatTimezoneLine(exifDatetime)}`,
    `Photo taken (metadata): ${formatMetadataPhotoTime(data, timezones)}`,
    `Photo taken (exif): ${mediaPath ? formatExifPhotoTime(mediaPath) : "not found"}`,
  ];
}

export function describeMediaFile(mediaPath) {
  const exif = resolveTimezoneFromExif(mediaPath);
  const photoTaken = formatExifPhotoTime(mediaPath);

  return [
    `Timezone (coordinates): not found`,
    `Timezone (filename): not found`,
    `Timezone (exif): ${formatTimezoneLine(exif)}`,
    `Photo taken (metadata): not found`,
    `Photo taken (exif): ${photoTaken}`,
  ];
}
