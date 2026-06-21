import {
  parseDatetimeFromTitle,
  parseExifLocalDateTime,
} from "./datetime-parsing.js";

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

export function inferOffsetFromFilename(title, photoTakenTimestamp) {
  const local = parseDatetimeFromTitle(title);
  if (!local) {
    return null;
  }

  return inferOffsetFromLocalDateTime(local, photoTakenTimestamp);
}

export function inferOffsetFromExifDateTime(dateTimeOriginal, photoTakenTimestamp) {
  const local = parseExifLocalDateTime(dateTimeOriginal);
  if (!local) {
    return null;
  }

  return inferOffsetFromLocalDateTime(local, photoTakenTimestamp);
}
