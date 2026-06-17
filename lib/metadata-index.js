import { readFileSync, readdirSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { mediaMatchKey, metadataBasename } from "./media-utils.js";

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
      const key = mediaMatchKey(derivedBasename);
      if (!byBasename.has(key)) {
        byBasename.set(key, []);
      }
      byBasename.get(key).push(metaPath);
    }

    try {
      const data = JSON.parse(readFileSync(metaPath, "utf8"));
      if (data.title) {
        const key = mediaMatchKey(String(data.title));
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

const metadataIndexCache = new Map();

export function getMetadataIndex(takeoutRoot) {
  const root = resolve(takeoutRoot);
  let cached = metadataIndexCache.get(root);
  if (!cached) {
    cached = buildMetadataIndex(root);
    metadataIndexCache.set(root, cached);
  }
  return cached;
}

export function clearMetadataIndexCache() {
  metadataIndexCache.clear();
}

export function metadataSignature(data) {
  return JSON.stringify({
    title: data.title ?? null,
    photoTakenTime: data.photoTakenTime ?? null,
    geoData: data.geoData ?? null,
    geoDataExif: data.geoDataExif ?? null,
  });
}

export function analyzeMetadataMatches(matches) {
  if (matches.length === 0) {
    return {
      primary: null,
      conflict: false,
      conflictNames: [],
    };
  }

  const groups = new Map();

  for (const matchPath of matches) {
    let signature = matchPath;

    try {
      const data = JSON.parse(readFileSync(matchPath, "utf8"));
      signature = metadataSignature(data);
    } catch {
      // Invalid JSON is treated as its own unique metadata entry.
    }

    if (!groups.has(signature)) {
      groups.set(signature, basename(matchPath));
    }
  }

  const conflictNames = [...groups.values()].sort();
  const conflict = conflictNames.length > 1;

  return {
    primary: matches[0],
    conflict,
    conflictNames,
  };
}

export function findMetadataMatches(mediaPath, index) {
  const key = mediaMatchKey(mediaPath);
  const matches = new Set([
    ...(index.byBasename.get(key) ?? []),
    ...(index.byTitle.get(key) ?? []),
  ]);

  return [...matches].sort();
}
