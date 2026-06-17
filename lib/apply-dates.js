import { existsSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { setFileDatesAsync } from "./media-utils.js";
import { DEFAULT_CONCURRENCY, mapWithConcurrency } from "./concurrency.js";
import { findMetadataMatches, getMetadataIndex } from "./metadata-index.js";
import { getPhotoTakenEpoch } from "../timezone-utils.js";

const DEFAULT_TARGET = resolve("data/target");
const DEFAULT_TAKEOUT = resolve("data/takeout");

function resolveTargetMediaPath(resolvedTarget, relPath) {
  const fullPath = resolve(resolvedTarget, relPath);
  const relativePath = relative(resolvedTarget, fullPath);

  if (relativePath.startsWith("..") || relativePath.includes(`..${sep}`)) {
    return null;
  }

  return existsSync(fullPath) ? fullPath : null;
}

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

async function applyOnePath(relPath, { resolvedTarget, index }) {
  const mediaPath = resolveTargetMediaPath(resolvedTarget, relPath);
  if (!mediaPath) {
    return { path: relPath, ok: false, error: "File not found" };
  }

  const { epoch, error } = resolvePhotoTakenEpoch(mediaPath, index);
  if (error) {
    return { path: relPath, ok: false, error };
  }

  try {
    await setFileDatesAsync(mediaPath, epoch);
    return { path: relPath, ok: true, photoTakenEpoch: epoch };
  } catch (err) {
    return { path: relPath, ok: false, error: err.message };
  }
}

export async function applyPhotoTakenTimes({
  paths,
  targetRoot = DEFAULT_TARGET,
  takeoutRoot = DEFAULT_TAKEOUT,
  concurrency = DEFAULT_CONCURRENCY,
}) {
  const resolvedTarget = resolve(targetRoot);
  const index = getMetadataIndex(resolve(takeoutRoot));

  const results = await mapWithConcurrency(
    paths,
    (relPath) => applyOnePath(relPath, { resolvedTarget, index }),
    concurrency,
  );

  return {
    applied: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    results,
  };
}
