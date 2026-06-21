import {
  formatFileDateFromEpoch,
  isValidEpochSeconds,
  parseDisplayDateTime,
} from "./dates.js";

function getPhotoTakenDisplayForSource(file, source) {
  if (source === "filename") {
    return file.photoTaken?.filename ?? null;
  }

  if (source === "metadata") {
    return file.photoTaken?.metadata ?? null;
  }

  if (source === "exif") {
    return file.photoTaken?.exif ?? null;
  }

  if (source === "manual") {
    return file.photoTaken?.manual ?? null;
  }

  return null;
}

export function getPhotoTakenEpochForSource(file, source) {
  const display = getPhotoTakenDisplayForSource(file, source);
  const parsedFromDisplay = parseDisplayDateTime(display);
  const storedEpoch = file.photoTakenEpochs?.[source];

  if (parsedFromDisplay != null) {
    if (isValidEpochSeconds(storedEpoch)) {
      const formattedStored = formatFileDateFromEpoch(storedEpoch);
      if (formattedStored === display) {
        return storedEpoch;
      }
    }

    return parsedFromDisplay;
  }

  if (isValidEpochSeconds(storedEpoch)) {
    return storedEpoch;
  }

  return null;
}

export function getDefaultPhotoTakenSelection(file) {
  if (file.photoTaken?.filename != null) {
    const epoch = getPhotoTakenEpochForSource(file, "filename");
    if (isValidEpochSeconds(epoch)) {
      return { source: "filename", epoch };
    }
  }

  if (file.photoTaken?.metadata != null) {
    const epoch = getPhotoTakenEpochForSource(file, "metadata");
    if (isValidEpochSeconds(epoch)) {
      return { source: "metadata", epoch };
    }
  }

  if (file.photoTaken?.exif != null) {
    const epoch = getPhotoTakenEpochForSource(file, "exif");
    if (isValidEpochSeconds(epoch)) {
      return { source: "exif", epoch };
    }
  }

  return { source: null, epoch: null };
}

export function getPhotoTakenEpoch(file) {
  const source = getPhotoTakenSource(file);
  if (source) {
    return getPhotoTakenEpochForSource(file, source);
  }

  return isValidEpochSeconds(file.photoTakenEpoch) ? file.photoTakenEpoch : null;
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
  return isValidEpochSeconds(getPhotoTakenEpoch(file));
}
