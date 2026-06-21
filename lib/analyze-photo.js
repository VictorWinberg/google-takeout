import { basename } from "node:path";
import {
  formatExifPhotoTime,
  formatFilenamePhotoTime,
  formatFilenamePhotoTimeFromTitle,
  formatMetadataPhotoTime,
  formatTimezoneLine,
  getExifPhotoTimeTimezone,
} from "./photo-time-format.js";
import {
  buildPhotoTakenEpochs,
  buildPhotoTakenSummary,
  buildTimezoneSummary,
  resolvePhotoTakenSelection,
} from "./photo-taken.js";
import {
  resolveTimezoneFromCoordinates,
  resolveTimezoneFromExif,
  resolveTimezoneFromExifDateTime,
  resolveTimezoneFromFilename,
} from "./timezone-resolve.js";

function resolveTimezones(data, mediaPath) {
  const coordinates = resolveTimezoneFromCoordinates(data);
  const filename = resolveTimezoneFromFilename(data);
  const exif = mediaPath ? resolveTimezoneFromExif(mediaPath) : null;
  const exifDatetime = mediaPath
    ? resolveTimezoneFromExifDateTime(data, mediaPath)
    : null;

  return { coordinates, filename, exif, exifDatetime };
}

export function analyzePhoto(data, { mediaPath } = {}) {
  const { coordinates, filename, exif, exifDatetime } = resolveTimezones(data, mediaPath);
  const timezones = { coordinates, filename, exif, exifDatetime };

  const photoTaken = buildPhotoTakenSummary(data, mediaPath, timezones);
  const { source: photoTakenSource, epoch: photoTakenEpoch } =
    resolvePhotoTakenSelection(data, mediaPath, photoTaken, timezones);

  return {
    timezones: buildTimezoneSummary(coordinates, filename, exif, exifDatetime),
    photoTaken,
    photoTakenSource,
    photoTakenEpoch,
    photoTakenEpochs: buildPhotoTakenEpochs(data, mediaPath),
  };
}

export function analyzeMediaFile(mediaPath) {
  const exif = resolveTimezoneFromExif(mediaPath);
  const filenameTime = formatFilenamePhotoTimeFromTitle(
    basename(mediaPath),
    { filename: null },
    false,
  );
  const photoTaken = {
    filename: filenameTime === "not found" ? null : filenameTime,
    filenameTimezone: null,
    metadata: null,
    metadataTimezone: null,
    exif: (() => {
      const value = formatExifPhotoTime(mediaPath, false);
      return value === "not found" ? null : value;
    })(),
    exifTimezone: getExifPhotoTimeTimezone(mediaPath),
  };
  const { source: photoTakenSource, epoch: photoTakenEpoch } =
    resolvePhotoTakenSelection({ title: basename(mediaPath) }, mediaPath, photoTaken);

  return {
    timezones: {
      coordinates: null,
      filename: null,
      exif: exif?.timezone ?? null,
      exifDatetime: null,
    },
    photoTaken,
    photoTakenSource,
    photoTakenEpoch,
    photoTakenEpochs: buildPhotoTakenEpochs(
      { title: basename(mediaPath) },
      mediaPath,
    ),
  };
}

export function describePhoto(data, { mediaPath } = {}) {
  const { coordinates, filename, exif, exifDatetime } = resolveTimezones(data, mediaPath);
  const timezones = { coordinates, filename, exif, exifDatetime };

  return [
    `Timezone (coordinates): ${formatTimezoneLine(coordinates)}`,
    `Timezone (filename): ${formatTimezoneLine(filename)}`,
    `Timezone (exif): ${formatTimezoneLine(exif)}`,
    `Timezone (exif datetime): ${formatTimezoneLine(exifDatetime)}`,
    `Photo taken (filename): ${formatFilenamePhotoTime(data, timezones)}`,
    `Photo taken (metadata): ${formatMetadataPhotoTime(data, timezones)}`,
    `Photo taken (exif): ${mediaPath ? formatExifPhotoTime(mediaPath) : "not found"}`,
  ];
}

export function describeMediaFile(mediaPath) {
  const exif = resolveTimezoneFromExif(mediaPath);
  const filenameTime = formatFilenamePhotoTimeFromTitle(
    basename(mediaPath),
    { filename: null },
  );
  const photoTaken = formatExifPhotoTime(mediaPath);

  return [
    `Timezone (coordinates): not found`,
    `Timezone (filename): not found`,
    `Timezone (exif): ${formatTimezoneLine(exif)}`,
    `Photo taken (filename): ${filenameTime}`,
    `Photo taken (metadata): not found`,
    `Photo taken (exif): ${photoTaken}`,
  ];
}
