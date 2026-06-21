export const DATE_MISMATCH_THRESHOLD_SECONDS = 60;

export const FILE_DATE_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const FILE_DATE_DISPLAY_RE =
  /^(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}), (\d{2}):(\d{2}):(\d{2})$/;

export function isValidEpochSeconds(epoch) {
  if (epoch == null || epoch === "") {
    return false;
  }

  const seconds = Number(epoch);
  if (!Number.isFinite(seconds)) {
    return false;
  }

  return Number.isFinite(new Date(seconds * 1000).getTime());
}

export function formatFileDateFromEpoch(epoch) {
  const seconds = Number(epoch);
  if (!Number.isFinite(seconds)) {
    return null;
  }

  const date = new Date(seconds * 1000);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return `${date.getDate()} ${FILE_DATE_MONTHS[date.getMonth()]} ${date.getFullYear()}, ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

export function normalizeEpoch(value) {
  if (value == null) {
    return null;
  }

  const epoch = Number(value);
  if (!Number.isFinite(epoch)) {
    return null;
  }

  return Number.isFinite(new Date(epoch * 1000).getTime()) ? epoch : null;
}

export function parseDisplayDateTime(value) {
  if (value == null || value === "") {
    return null;
  }

  const match = String(value).match(FILE_DATE_DISPLAY_RE);
  if (!match) {
    return null;
  }

  const [, day, monthName, year, hour, minute, second] = match;
  const month = FILE_DATE_MONTHS.indexOf(monthName);
  if (month < 0) {
    return null;
  }

  const date = new Date(
    Number(year),
    month,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );

  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== month ||
    date.getDate() !== Number(day) ||
    date.getHours() !== Number(hour) ||
    date.getMinutes() !== Number(minute) ||
    date.getSeconds() !== Number(second)
  ) {
    return null;
  }

  return Math.floor(date.getTime() / 1000);
}

function resolveComparableEpoch({ display, epoch }) {
  return normalizeEpoch(epoch) ?? parseDisplayDateTime(display);
}

function datesMatchWithinThreshold(fileEpoch, referenceEpoch) {
  if (fileEpoch == null || referenceEpoch == null) {
    return false;
  }

  return (
    Math.abs(fileEpoch - referenceEpoch) <= DATE_MISMATCH_THRESHOLD_SECONDS
  );
}

export function fileDateMatchesReference({ display, epoch }, referenceDisplay, referenceEpoch) {
  if (referenceDisplay != null) {
    return display != null && display !== "" && display === referenceDisplay;
  }

  const fileComparableEpoch = resolveComparableEpoch({ display, epoch });
  const referenceComparableEpoch = resolveComparableEpoch({
    display: referenceDisplay,
    epoch: referenceEpoch,
  });

  return datesMatchWithinThreshold(fileComparableEpoch, referenceComparableEpoch);
}
