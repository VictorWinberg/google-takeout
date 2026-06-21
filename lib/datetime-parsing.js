// Matches YYYYMMDD with optional time in common filename layouts:
//   20250102_152300, instagram_20250102_152300, instagram_20250102152300,
//   instagram_202501021523, PXL_20250615_075130046, IMG-20250830-WA0003
export const DATETIME_TITLE_CANDIDATE_RE =
  /(?:^|[^0-9])(?:(\d{4})(\d{2})(\d{2})_(\d{2,})|(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2})\d*|(\d{2})(\d{2}))?)(?=[^0-9]|$)/g;

export const DATE_ONLY_FILENAME_PATTERN = /IMG-(\d{4})(\d{2})(\d{2})-/i;

export const EXIF_DATETIME_RE =
  /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:([+-]\d{2}:\d{2}))?$/;

export const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function isValidLocalDateParts({ year, month, day }) {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function isValidLocalDateTimeParts({ year, month, day, hour, minute, second }) {
  if (
    !isValidLocalDateParts({ year, month, day }) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return false;
  }

  const date = new Date(year, month - 1, day, hour, minute, second);
  return (
    date.getHours() === hour &&
    date.getMinutes() === minute &&
    date.getSeconds() === second
  );
}

function timeDigitsToParts(digits) {
  if (!digits) {
    return { hour: 0, minute: 0, second: 0 };
  }

  return {
    hour: Number(digits.slice(0, 2)),
    minute: Number(digits.slice(2, 4)),
    second: digits.length >= 6 ? Number(digits.slice(4, 6)) : 0,
  };
}

function localPartsFromCandidateMatch(match) {
  const [
    ,
    sepYear,
    sepMonth,
    sepDay,
    sepTimeDigits,
    compactYear,
    compactMonth,
    compactDay,
    compactHour,
    compactMinute,
    compactSecond,
    compactHourNoSec,
    compactMinuteNoSec,
  ] = match;

  const year = Number(sepYear ?? compactYear);
  const month = Number(sepMonth ?? compactMonth);
  const day = Number(sepDay ?? compactDay);
  const time =
    sepTimeDigits != null
      ? timeDigitsToParts(sepTimeDigits)
      : compactHour != null
        ? {
            hour: Number(compactHour),
            minute: Number(compactMinute),
            second: Number(compactSecond),
          }
        : compactHourNoSec != null
          ? {
              hour: Number(compactHourNoSec),
              minute: Number(compactMinuteNoSec),
              second: 0,
            }
          : { hour: 0, minute: 0, second: 0 };

  return { year, month, day, ...time };
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

  for (const match of value.matchAll(DATETIME_TITLE_CANDIDATE_RE)) {
    const local = localPartsFromCandidateMatch(match);

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
