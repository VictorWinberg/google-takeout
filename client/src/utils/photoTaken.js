import { isValidEpochSeconds, parseDisplayDateTime } from "./dates.js";

export function getPhotoTakenEpochForSource(file, source) {
  const epoch = file.photoTakenEpochs?.[source];
  if (isValidEpochSeconds(epoch)) {
    return epoch;
  }

  if (source === "filename") {
    return parseDisplayDateTime(file.photoTaken?.filename);
  }

  if (source === "metadata") {
    return parseDisplayDateTime(file.photoTaken?.metadata);
  }

  if (source === "exif") {
    return parseDisplayDateTime(file.photoTaken?.exif);
  }

  if (source === "manual") {
    return parseDisplayDateTime(file.photoTaken?.manual);
  }

  return null;
}

export function getDefaultPhotoTakenSelection(file) {
  if (
    file.photoTaken?.filename != null &&
    isValidEpochSeconds(file.photoTakenEpochs?.filename)
  ) {
    return {
      source: "filename",
      epoch: file.photoTakenEpochs.filename,
    };
  }

  if (
    file.photoTaken?.metadata != null &&
    isValidEpochSeconds(file.photoTakenEpochs?.metadata)
  ) {
    return {
      source: "metadata",
      epoch: file.photoTakenEpochs.metadata,
    };
  }

  if (
    file.photoTaken?.exif != null &&
    isValidEpochSeconds(file.photoTakenEpochs?.exif)
  ) {
    return {
      source: "exif",
      epoch: file.photoTakenEpochs.exif,
    };
  }

  return { source: null, epoch: null };
}

export function getPhotoTakenSource(file) {
  if (file.photoTakenSource) {
    return file.photoTakenSource;
  }

  if (file.photoTaken?.metadata != null) {
    return "metadata";
  }

  if (file.photoTaken?.exif != null) {
    return "exif";
  }

  return null;
}

export function getChosenPhotoTakenReference(file) {
  const source = getPhotoTakenSource(file);

  if (source === "filename") {
    return {
      display: file.photoTaken?.filename ?? null,
      epoch: getPhotoTakenEpochForSource(file, "filename"),
    };
  }

  if (source === "metadata") {
    return {
      display: file.photoTaken?.metadata ?? null,
      epoch: getPhotoTakenEpochForSource(file, "metadata"),
    };
  }

  if (source === "exif") {
    return {
      display: file.photoTaken?.exif ?? null,
      epoch: getPhotoTakenEpochForSource(file, "exif"),
    };
  }

  if (source === "manual") {
    return {
      display: file.photoTaken?.manual ?? null,
      epoch: getPhotoTakenEpochForSource(file, "manual"),
    };
  }

  return { display: null, epoch: null };
}

export function formatPhotoTakenTimezone({ source, value }) {
  return `${source}: ${value}`;
}

export function getFilenameTimezoneInfo(file) {
  if (file.photoTaken?.filenameTimezone) {
    return file.photoTaken.filenameTimezone;
  }

  if (!file.photoTaken?.filename || !file.timezones?.filename) {
    return null;
  }

  return { source: "filename", value: file.timezones.filename };
}

export function getMetadataTimezoneInfo(file) {
  if (file.photoTaken?.metadataTimezone) {
    return file.photoTaken.metadataTimezone;
  }

  if (!file.photoTaken?.metadata || !file.timezones) {
    return null;
  }

  const { coordinates } = file.timezones;
  if (coordinates) return { source: "coordinates", value: coordinates };
  return null;
}

export function getExifTimezoneInfo(file) {
  if (file.photoTaken?.exifTimezone) {
    return file.photoTaken.exifTimezone;
  }

  if (!file.photoTaken?.exif || !file.timezones?.exif) {
    return null;
  }

  return { source: "exif", value: file.timezones.exif };
}

export function canApply(file) {
  return isValidEpochSeconds(file.photoTakenEpoch);
}
