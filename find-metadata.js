#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { findMediaPath, metadataBasename, setFileDates } from "./media-utils.js";
import {
  describePhoto,
  getPhotoTakenEpoch,
  resolveTimezoneFromCoordinates,
  resolveTimezoneFromExif,
  resolveTimezoneFromExifDateTime,
  resolveTimezoneFromFilename,
} from "./timezone-utils.js";

const SKIP_DIRS = new Set(["node_modules", ".git"]);

const MEDIA_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".heic",
  ".heif",
  ".webp",
  ".mov",
  ".mp4",
  ".m4v",
  ".avi",
  ".mkv",
]);

function isMetadataJson(name) {
  if (!name.endsWith(".json")) return false;

  return (
    name.includes(".supplemental-metadata") ||
    name.endsWith(".suppl.json") ||
    name.startsWith("att.") ||
    name.includes("..json")
  );
}

function findMetadataFiles(root) {
  const results = [];

  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(fullPath);
      } else if (entry.isFile() && isMetadataJson(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  walk(root);
  return results.sort();
}

function isMediaFile(name) {
  return MEDIA_EXTENSIONS.has(extname(name).toLowerCase());
}

function findMediaFiles(root) {
  const results = [];

  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(fullPath);
      } else if (entry.isFile() && isMediaFile(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  walk(root);
  return results.sort();
}

function buildMetadataIndex(takeoutRoot) {
  const byTitle = new Map();
  const byBasename = new Map();

  for (const metaPath of findMetadataFiles(takeoutRoot)) {
    const derivedBasename = metadataBasename(basename(metaPath));
    if (derivedBasename) {
      const key = derivedBasename.toLowerCase();
      if (!byBasename.has(key)) {
        byBasename.set(key, []);
      }
      byBasename.get(key).push(metaPath);
    }

    try {
      const data = JSON.parse(readFileSync(metaPath, "utf8"));
      if (data.title) {
        const key = String(data.title).toLowerCase();
        if (!byTitle.has(key)) {
          byTitle.set(key, []);
        }
        byTitle.get(key).push(metaPath);
      }
    } catch {
      // Skip invalid metadata when building the index.
    }
  }

  return { byTitle, byBasename };
}

function findMetadataMatches(mediaPath, index) {
  const key = basename(mediaPath).toLowerCase();
  const matches = new Set([
    ...(index.byBasename.get(key) ?? []),
    ...(index.byTitle.get(key) ?? []),
  ]);

  return [...matches].sort();
}

function matchMediaToMetadata(myFoldersRoot, takeoutRoot) {
  const index = buildMetadataIndex(takeoutRoot);
  const mediaFiles = findMediaFiles(myFoldersRoot);
  let hitCount = 0;

  for (const mediaPath of mediaFiles) {
    const matches = findMetadataMatches(mediaPath, index);

    if (matches.length > 0) {
      hitCount++;
      const data = JSON.parse(readFileSync(matches[0], "utf8"));
      const relPath = relative(myFoldersRoot, mediaPath);

      console.log(relPath);
      for (const line of describePhoto(data, { mediaPath })) {
        console.log(line);
      }

      const photoTakenEpoch = getPhotoTakenEpoch(data, mediaPath);
      if (photoTakenEpoch != null) {
        setFileDates(mediaPath, photoTakenEpoch);
      }

      console.log("");
    }
  }

  console.error(
    `Matched ${hitCount} of ${mediaFiles.length} media file(s) in ${myFoldersRoot}`,
  );
}

function classifyGeoData(path) {
  let data;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return "invalid";
  }

  const geo = data.geoData;
  if (geo?.latitude == null || geo?.longitude == null) {
    return "missing";
  }

  if (geo.latitude === 0 && geo.longitude === 0) {
    return "zero";
  }

  return "nonZero";
}

function countGeoData(files) {
  const counts = { nonZero: 0, zero: 0, missing: 0, invalid: 0 };

  for (const file of files) {
    counts[classifyGeoData(file)]++;
  }

  return counts;
}

function countTimezones(files, searchRoots = []) {
  const counts = {
    coordinates: 0,
    filename: 0,
    exif: 0,
    "exif-datetime": 0,
    invalid: 0,
  };

  for (const file of files) {
    let data;
    try {
      data = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      counts.invalid++;
      continue;
    }

    const mediaPath = findMediaPath(file, searchRoots);

    if (resolveTimezoneFromCoordinates(data)) {
      counts.coordinates++;
    }
    if (resolveTimezoneFromFilename(data)) {
      counts.filename++;
    }
    if (mediaPath && resolveTimezoneFromExif(mediaPath)) {
      counts.exif++;
    }
    if (mediaPath && resolveTimezoneFromExifDateTime(data, mediaPath)) {
      counts["exif-datetime"]++;
    }
  }

  return counts;
}

const { values } = parseArgs({
  options: {
    root: { type: "string", default: "." },
    count: { type: "boolean", default: false },
    "geo-count": { type: "boolean", default: false },
    "timezone-count": { type: "boolean", default: false },
    match: { type: "boolean", default: false },
    "my-folders": { type: "string" },
    takeout: { type: "string" },
  },
});

if (values.match) {
  if (!values["my-folders"] || !values.takeout) {
    console.error(
      "Usage: node find-metadata.js --match --my-folders <path> --takeout <path>",
    );
    process.exit(1);
  }

  matchMediaToMetadata(
    resolve(values["my-folders"]),
    resolve(values.takeout),
  );
  process.exit(0);
}

const root = resolve(values.root);
const files = findMetadataFiles(root);
const mediaSearchRoots = values["my-folders"]
  ? [resolve(values["my-folders"])]
  : [];

if (values["geo-count"] || values["timezone-count"]) {
  console.log(`Total metadata files: ${files.length}`);

  if (values["geo-count"]) {
    const { nonZero, zero, missing, invalid } = countGeoData(files);

    console.log(`With location (geoData lat/lng ≠ 0): ${nonZero}`);
    console.log(`Zero location (geoData lat/lng = 0): ${zero}`);
    if (missing > 0) {
      console.log(`Missing geoData: ${missing}`);
    }
    if (invalid > 0) {
      console.log(`Invalid JSON: ${invalid}`);
    }
  }

  if (values["timezone-count"]) {
    const { coordinates, filename, exif, "exif-datetime": exifDatetime, invalid } =
      countTimezones(files, mediaSearchRoots);

    if (values["geo-count"]) {
      console.log("");
    }

    console.log(`Timezone (coordinates): ${coordinates}`);
    console.log(`Timezone (filename): ${filename}`);
    console.log(`Timezone (exif): ${exif}`);
    console.log(`Timezone (exif datetime): ${exifDatetime}`);
    if (invalid > 0) {
      console.log(`Invalid JSON: ${invalid}`);
    }
  }
} else if (values.count) {
  console.log(files.length);
} else {
  for (const file of files) {
    console.log(relative(root, file) || file);
  }
}
