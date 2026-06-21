export function normalizeEpochSeconds(epoch) {
  if (epoch == null || epoch === "") {
    return null;
  }

  const seconds = Number(epoch);
  if (!Number.isFinite(seconds)) {
    return null;
  }

  const time = new Date(seconds * 1000).getTime();
  return Number.isFinite(time) ? seconds : null;
}

export function isValidEpochSeconds(epoch) {
  return normalizeEpochSeconds(epoch) != null;
}
