// Google Photos: 20250102_152300
// Prefixed: instagram_20250102_152300, instagram_202501021523, instagram_20250102152300
// Pixlr: pixlr_20250209205832404 (optional sub-second digits)
// WhatsApp: IMG-20250830-WA0003 (date only)
export const DATETIME_TITLE_PATTERNS = [
  /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/,
  /_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})(?:\.|[^0-9]|$)/,
  /_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\d*(?:\.|[^0-9]|$)/,
  /_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(?:\.|[^0-9]|$)/,
  /IMG-(\d{4})(\d{2})(\d{2})-/i,
];

export const DATE_ONLY_FILENAME_PATTERN = /IMG-(\d{4})(\d{2})(\d{2})-/i;

export const EXIF_DATETIME_RE =
  /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:([+-]\d{2}:\d{2}))?$/;

export const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function isValidLocalDateTimeParts({ year, month, day, hour, minute, second }) {
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return false;
  }

  const date = new Date(year, month - 1, day, hour, minute, second);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute &&
    date.getSeconds() === second
  );
}

export function isDateOnlyFilenameTitle(title) {
  if (title == null || title === "") {
    return false;
  }

  return DATE_ONLY_FILENAME_PATTERN.test(String(title));
}

export function localDateTimePartsToEpoch({ year, month, day, hour, minute, second }) {
  return Math.floor(
    new Date(year, month - 1, day, hour, minute, second).getTime() / 1000,
  );
}

export function parseDatetimeFromTitle(title) {
  if (title == null || title === "") {
    return null;
  }

  const value = String(title);

  for (const pattern of DATETIME_TITLE_PATTERNS) {
    const match = value.match(pattern);
    if (!match) {
      continue;
    }

    const [, year, month, day, hour = "0", minute = "0", second = "0"] = match;
    const local = {
      year: Number(year),
      month: Number(month),
      day: Number(day),
      hour: Number(hour),
      minute: Number(minute),
      second: Number(second),
    };

    if (isValidLocalDateTimeParts(local)) {
      return local;
    }
  }

  return null;
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
