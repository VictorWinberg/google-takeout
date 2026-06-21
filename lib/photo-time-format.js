import {
  EXIF_DATETIME_RE,
  MONTHS,
  parseDatetimeFromTitle,
} from "./datetime-parsing.js";
import { getExifPhotoTakenDatetime, readExifTags } from "./exif.js";
import { formatUtcOffset, parseOffsetString } from "./offset.js";

export function formatTimezoneLine(result) {
  return result ? result.timezone : "not found";
}

function formatLocalTime(epochSeconds, timeZone, includeTimezone = true) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    ...(includeTimezone ? { timeZoneName: "short" } : {}),
  }).formatToParts(new Date(epochSeconds * 1000));

  const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
  const month = Number(get("month"));
  const day = Number(get("day"));
  const base = `${day} ${MONTHS[month - 1]} ${get("year")}, ${get("hour")}:${get("minute")}:${get("second")}`;

  if (!includeTimezone) {
    return base;
  }

  return `${base} ${get("timeZoneName")}`;
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

export function formatFilenamePhotoTimeFromTitle(title, timezones, includeTimezone = true) {
  const local = parseDatetimeFromTitle(title);
  if (!local) {
    return "not found";
  }

  const base = `${local.day} ${MONTHS[local.month - 1]} ${local.year}, ${String(local.hour).padStart(2, "0")}:${String(local.minute).padStart(2, "0")}:${String(local.second).padStart(2, "0")}`;

  if (!includeTimezone || !timezones.filename?.timezone) {
    return base;
  }

  return `${base} ${timezones.filename.timezone}`;
}

export function formatFilenamePhotoTime(data, timezones, includeTimezone = true) {
  return formatFilenamePhotoTimeFromTitle(data.title, timezones, includeTimezone);
}

export function formatMetadataPhotoTime(data, timezones, includeTimezone = true) {
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

  return formatUtcTime(photoTakenTimestamp, includeTimezone);
}

export function formatExifPhotoTime(mediaPath, includeTimezone = true) {
  const exif = readExifTags(mediaPath);
  if (!exif) {
    return "not found";
  }

  const value = getExifPhotoTakenDatetime(exif);
  if (!value) {
    return "not found";
  }

  return formatExifDatetimeString(value, includeTimezone);
}

export function getFilenamePhotoTimeTimezone(timezones) {
  if (timezones.filename?.timezone) {
    return { source: "filename", value: timezones.filename.timezone };
  }

  return null;
}

export function getMetadataPhotoTimeTimezone(data, timezones) {
  const photoTakenTimestamp = Number(data.photoTakenTime?.timestamp);
  if (!Number.isFinite(photoTakenTimestamp)) {
    return null;
  }

  if (timezones.coordinates) {
    return { source: "coordinates", value: timezones.coordinates.timezone };
  }

  return null;
}

export function getExifPhotoTimeTimezone(mediaPath) {
  const exif = readExifTags(mediaPath);
  if (!exif) {
    return null;
  }

  const value = getExifPhotoTakenDatetime(exif);
  if (!value) {
    return null;
  }

  const offsetMatch = String(value).match(/([+-]\d{2}:\d{2})$/);
  if (offsetMatch) {
    const offsetMinutes = parseOffsetString(offsetMatch[1]);
    if (offsetMinutes != null) {
      return { source: "exif", value: formatUtcOffset(offsetMinutes) };
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
