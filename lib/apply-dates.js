import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { setFileDates } from "./media-utils.js";
import {
  buildMetadataIndex,
  findMediaFiles,
  findMetadataMatches,
} from "./metadata-index.js";
import { getPhotoTakenEpoch } from "../timezone-utils.js";

const DEFAULT_TARGET = resolve("data/target");
const DEFAULT_TAKEOUT = resolve("data/takeout");

function resolvePhotoTakenEpoch(mediaPath, index) {
  const matches = findMetadataMatches(mediaPath, index);
  let data = {};

  if (matches.length > 0) {
    try {
      data = JSON.parse(readFileSync(matches[0], "utf8"));
    } catch {
      return { error: "Invalid metadata JSON" };
    }
  }

  const epoch = getPhotoTakenEpoch(data, mediaPath);
  if (epoch == null) {
    return { error: "No photo taken time found" };
  }

  return { epoch };
}

export function applyPhotoTakenTimes({
  paths,
  targetRoot = DEFAULT_TARGET,
  takeoutRoot = DEFAULT_TAKEOUT,
}) {
  const resolvedTarget = resolve(targetRoot);
  const resolvedTakeout = resolve(takeoutRoot);
  const index = buildMetadataIndex(resolvedTakeout);

  const pathMap = new Map(
    findMediaFiles(resolvedTarget).map((mediaPath) => [
      relative(resolvedTarget, mediaPath),
      mediaPath,
    ]),
  );

  const results = [];

  for (const relPath of paths) {
    const mediaPath = pathMap.get(relPath);
    if (!mediaPath) {
      results.push({ path: relPath, ok: false, error: "File not found" });
      continue;
    }

    const { epoch, error } = resolvePhotoTakenEpoch(mediaPath, index);
    if (error) {
      results.push({ path: relPath, ok: false, error });
      continue;
    }

    try {
      setFileDates(mediaPath, epoch);
      results.push({ path: relPath, ok: true, photoTakenEpoch: epoch });
    } catch (err) {
      results.push({ path: relPath, ok: false, error: err.message });
    }
  }

  return {
    applied: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    results,
  };
}
