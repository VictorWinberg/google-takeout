import { readFileSync, readdirSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { metadataBasename } from "./media-utils.js";

const SKIP_DIRS = new Set(["node_modules", ".git"]);

export const MEDIA_EXTENSIONS = new Set([
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

export function isMetadataJson(name) {
  if (!name.endsWith(".json")) return false;

  return (
    name.includes(".supplemental-metadata") ||
    name.endsWith(".suppl.json") ||
    name.startsWith("att.") ||
    name.includes("..json")
  );
}

export function findMetadataFiles(root) {
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

export function findMediaFiles(root) {
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

export function buildMetadataIndex(takeoutRoot) {
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

export function findMetadataMatches(mediaPath, index) {
  const key = basename(mediaPath).toLowerCase();
  const matches = new Set([
    ...(index.byBasename.get(key) ?? []),
    ...(index.byTitle.get(key) ?? []),
  ]);

  return [...matches].sort();
}
