#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { findMediaPath } from "./media-utils.js";
import {
  describeMediaFile,
  describePhoto,
  getTimezoneFromCoords,
} from "./timezone-utils.js";

function loadMetadata(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const { values } = parseArgs({
  options: {
    json: { type: "string" },
    file: { type: "string" },
    lat: { type: "string" },
    lng: { type: "string" },
    "my-folders": { type: "string" },
  },
});

try {
  if (values.json) {
    const mediaSearchRoots = values["my-folders"] ? [values["my-folders"]] : [];
    const mediaPath = findMediaPath(values.json, mediaSearchRoots);
    const lines = describePhoto(loadMetadata(values.json), { mediaPath });
    for (const line of lines) {
      console.log(line);
    }
  } else if (values.file) {
    for (const line of describeMediaFile(values.file)) {
      console.log(line);
    }
  } else if (values.lat != null && values.lng != null) {
    const lat = Number(values.lat);
    const lng = Number(values.lng);
    const timezone = getTimezoneFromCoords(lat, lng);
    if (!timezone) {
      console.error(`No timezone found for lat=${lat}, lng=${lng}`);
      process.exit(1);
    }

    console.log(`Timezone: ${timezone} (coordinates)`);
  } else {
    console.error("Usage: node get-timezone.js --lat <lat> --lng <lng>");
    console.error("   or: node get-timezone.js --json <metadata.json>");
    console.error("   or: node get-timezone.js --file <media-file>");
    process.exit(1);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
