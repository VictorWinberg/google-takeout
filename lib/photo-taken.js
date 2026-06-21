import {
  EXIF_DATETIME_RE,
  isDateOnlyFilenameTitle,
  localDateTimePartsToEpoch,
  parseDatetimeFromTitle,
} from "./datetime-parsing.js";
import { normalizeEpochSeconds } from "./epoch-utils.js";
import {
  getExifMinutesSeconds,
  getExifPhotoTakenDatetime,
  readExifTags,
} from "./exif.js";
import {
  formatExifPhotoTime,
  formatFilenamePhotoTime,
  formatMetadataPhotoTime,
  getExifPhotoTimeTimezone,
  getFilenamePhotoTimeTimezone,
  getMetadataPhotoTimeTimezone,
} from "./photo-time-format.js";
import { inferOffsetFromFilename, parseOffsetString } from "./offset.js";
import {
  resolveTimezoneFromCoordinates,
  resolveTimezoneFromExif,
  resolveTimezoneFromExifDateTime,
  resolveTimezoneFromFilename,
} from "./timezone-resolve.js";

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

  const value = getExifPhotoTakenDatetime(exif);
  if (!value) {
    return null;
  }

  return parseExifDatetimeToEpoch(value);
}

export function getPhotoTakenEpochFromFilename(data) {
  const local = parseDatetimeFromTitle(data.title);
  if (!local) {
    return null;
  }

  if (isDateOnlyFilenameTitle(data.title)) {
    return normalizeEpochSeconds(localDateTimePartsToEpoch(local));
  }

  const photoTakenTimestamp = Number(data.photoTakenTime?.timestamp);
  if (!Number.isFinite(photoTakenTimestamp)) {
    return null;
  }

  const offsetMinutes = inferOffsetFromFilename(data.title, photoTakenTimestamp);
  if (offsetMinutes == null) {
    return null;
  }

  const localAsUtcMs = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  );

  return Math.floor((localAsUtcMs - offsetMinutes * 60_000) / 1000);
}

export function getMetadataPhotoTakenEpoch(data) {
  const metadataEpoch = Number(data?.photoTakenTime?.timestamp);
  return Number.isFinite(metadataEpoch) ? metadataEpoch : null;
}

function getUtcMinutesSeconds(epochSeconds) {
  const date = new Date(epochSeconds * 1000);
  return {
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
  };
}

function metadataExifMinutesSecondsMatch(data, mediaPath) {
  const metadataEpoch = getMetadataPhotoTakenEpoch(data);
  if (metadataEpoch == null) {
    return false;
  }

  const metadataParts = getUtcMinutesSeconds(metadataEpoch);
  const exifParts = getExifMinutesSeconds(mediaPath);
  if (!exifParts) {
    return false;
  }

  return (
    metadataParts.minute === exifParts.minute &&
    metadataParts.second === exifParts.second
  );
}

function shouldPreferExifOverMetadata(data, mediaPath, timezones, photoTaken) {
  if (!mediaPath || photoTaken?.exif == null) {
    return false;
  }

  if (
    getMetadataPhotoTakenEpoch(data) == null &&
    photoTaken?.metadata == null
  ) {
    return false;
  }

  if (timezones?.coordinates) {
    return false;
  }

  if (!photoTaken?.exifTimezone && !getExifPhotoTimeTimezone(mediaPath)) {
    return false;
  }

  if (getPhotoTakenEpochFromExif(mediaPath) == null) {
    return false;
  }

  return metadataExifMinutesSecondsMatch(data, mediaPath);
}

export function getPhotoTakenSource(photoTaken, data = {}, { mediaPath, timezones } = {}) {
  // 1. filename
  if (
    photoTaken?.filename != null &&
    getPhotoTakenEpochFromFilename(data) != null
  ) {
    return "filename";
  }

  const hasMetadata =
    getMetadataPhotoTakenEpoch(data) != null || photoTaken?.metadata != null;
  const hasExif = photoTaken?.exif != null;

  // 2. metadata with timezone (GPS coordinates)
  if (hasMetadata && timezones?.coordinates) {
    return "metadata";
  }

  // 3. exif with timezone when minutes/seconds match metadata
  if (
    hasMetadata &&
    hasExif &&
    shouldPreferExifOverMetadata(data, mediaPath, timezones, photoTaken)
  ) {
    return "exif";
  }

  // 4. metadata without timezone
  if (hasMetadata) {
    return "metadata";
  }

  // 5. exif
  if (hasExif) {
    return "exif";
  }

  return null;
}

export function resolvePhotoTakenSelection(
  data,
  mediaPath,
  photoTaken,
  timezones = null,
) {
  const source = getPhotoTakenSource(photoTaken, data, { mediaPath, timezones });
  if (!source) {
    return { source: null, epoch: null };
  }

  const rawEpoch =
    source === "filename"
      ? getPhotoTakenEpochFromFilename(data)
      : source === "exif"
        ? getPhotoTakenEpochFromExif(mediaPath)
        : getMetadataPhotoTakenEpoch(data);

  const epoch = normalizeEpochSeconds(rawEpoch);
  return { source: epoch != null ? source : null, epoch };
}

export function buildTimezoneSummary(coordinates, filename, exif, exifDatetime) {
  return {
    coordinates: coordinates?.timezone ?? null,
    filename: filename?.timezone ?? null,
    exif: exif?.timezone ?? null,
    exifDatetime: exifDatetime?.timezone ?? null,
  };
}

export function buildPhotoTakenSummary(data, mediaPath, timezones) {
  const filenameTime = formatFilenamePhotoTime(data, timezones, false);
  const metadataTime = formatMetadataPhotoTime(data, timezones, false);
  const exifTime = mediaPath ? formatExifPhotoTime(mediaPath, false) : null;

  return {
    filename: filenameTime === "not found" ? null : filenameTime,
    filenameTimezone: getFilenamePhotoTimeTimezone(timezones),
    metadata: metadataTime === "not found" ? null : metadataTime,
    metadataTimezone: getMetadataPhotoTimeTimezone(data, timezones),
    exif: exifTime === "not found" ? null : exifTime,
    exifTimezone: mediaPath ? getExifPhotoTimeTimezone(mediaPath) : null,
  };
}

export function buildPhotoTakenEpochs(data, mediaPath) {
  return {
    filename: normalizeEpochSeconds(getPhotoTakenEpochFromFilename(data)),
    metadata: normalizeEpochSeconds(getMetadataPhotoTakenEpoch(data)),
    exif: normalizeEpochSeconds(
      mediaPath ? getPhotoTakenEpochFromExif(mediaPath) : null,
    ),
  };
}

export function getPhotoTakenEpoch(data, mediaPath) {
  const coordinates = resolveTimezoneFromCoordinates(data);
  const filename = resolveTimezoneFromFilename(data);
  const exif = mediaPath ? resolveTimezoneFromExif(mediaPath) : null;
  const exifDatetime = mediaPath
    ? resolveTimezoneFromExifDateTime(data, mediaPath)
    : null;
  const timezones = { coordinates, filename, exif, exifDatetime };
  const photoTaken = buildPhotoTakenSummary(data, mediaPath, timezones);

  return resolvePhotoTakenSelection(data, mediaPath, photoTaken, timezones).epoch;
}
