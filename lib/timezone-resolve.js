import { getCoords, getTimezoneFromCoords } from "./coords.js";
import { readExifTags, extractOffsetFromExif } from "./exif.js";
import {
  formatUtcOffset,
  inferOffsetFromExifDateTime,
  inferOffsetFromFilename,
} from "./offset.js";

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
