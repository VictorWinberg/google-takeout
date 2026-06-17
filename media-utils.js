import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";

export function metadataBasename(filename) {
  if (filename.startsWith("att.")) {
    return null;
  }

  if (filename.includes(".supplemental-metadata")) {
    return filename.replace(/\.supplemental-metadata(\(\d+\))?\.json$/i, "");
  }

  if (filename.endsWith(".suppl.json")) {
    return filename.slice(0, -".suppl.json".length);
  }

  if (filename.endsWith("..json")) {
    return filename.slice(0, -"..json".length);
  }

  return null;
}

export function mediaPathFromMetadata(metadataPath) {
  const mediaName = metadataBasename(basename(metadataPath));
  if (!mediaName) {
    return null;
  }

  const candidate = join(dirname(metadataPath), mediaName);
  return existsSync(candidate) ? candidate : null;
}

export function findMediaPath(metadataPath, searchRoots = []) {
  const sibling = mediaPathFromMetadata(metadataPath);
  if (sibling) {
    return sibling;
  }

  const mediaName = metadataBasename(basename(metadataPath));
  if (!mediaName) {
    return null;
  }

  const key = mediaName.toLowerCase();
  for (const root of searchRoots) {
    const match = buildMediaIndex(root).get(key);
    if (match) {
      return match;
    }
  }

  return null;
}

const mediaIndexCache = new Map();

function buildMediaIndex(root) {
  if (mediaIndexCache.has(root)) {
    return mediaIndexCache.get(root);
  }

  const index = new Map();
  const mediaExtensions = new Set([
    ".jpg", ".jpeg", ".png", ".gif", ".heic", ".heif", ".webp",
    ".mov", ".mp4", ".m4v", ".avi", ".mkv",
  ]);

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
        if (entry.name === "node_modules" || entry.name === ".git") {
          continue;
        }
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase();
        if (mediaExtensions.has(ext)) {
          const key = entry.name.toLowerCase();
          if (!index.has(key)) {
            index.set(key, fullPath);
          }
        }
      }
    }
  }

  walk(root);
  mediaIndexCache.set(root, index);
  return index;
}

function formatSetFileDate(date) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");

  return `${mm}/${dd}/${yyyy} ${hh}:${min}:${ss}`;
}

export function setFileDates(mediaPath, epochSeconds) {
  const date = new Date(epochSeconds * 1000);
  const setFileDate = formatSetFileDate(date);

  execFileSync("SetFile", ["-d", setFileDate, "-m", setFileDate, mediaPath]);
}
