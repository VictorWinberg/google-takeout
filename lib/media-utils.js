import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

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

function formatFileDate(date) {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

function parseLocalDateTime(value) {
  const match = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, month, day, year, hour, minute, second] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
}

function readFileDatesFromStat(mediaPath) {
  const stat = statSync(mediaPath);
  const createdAt = stat.birthtime;
  const modifiedAt = stat.mtime;
  const createdAtValid = Number.isFinite(createdAt.getTime()) && createdAt.getTime() > 0;

  return {
    createdAt: createdAtValid ? formatFileDate(createdAt) : null,
    modifiedAt: formatFileDate(modifiedAt),
    createdAtEpoch: createdAtValid ? Math.floor(createdAt.getTime() / 1000) : null,
    modifiedAtEpoch: Math.floor(modifiedAt.getTime() / 1000),
  };
}

function readFileDatesFromGetFileInfo(mediaPath) {
  const createdRaw = execFileSync("GetFileInfo", ["-d", mediaPath], {
    encoding: "utf8",
  }).trim();
  const modifiedRaw = execFileSync("GetFileInfo", ["-m", mediaPath], {
    encoding: "utf8",
  }).trim();

  const createdAt = parseLocalDateTime(createdRaw);
  const modifiedAt = parseLocalDateTime(modifiedRaw);

  return {
    createdAt: createdAt ? formatFileDate(createdAt) : createdRaw || null,
    modifiedAt: modifiedAt ? formatFileDate(modifiedAt) : modifiedRaw || null,
    createdAtEpoch: createdAt ? Math.floor(createdAt.getTime() / 1000) : null,
    modifiedAtEpoch: modifiedAt ? Math.floor(modifiedAt.getTime() / 1000) : null,
  };
}

export function readFileDates(mediaPath) {
  try {
    if (process.platform === "darwin") {
      return readFileDatesFromGetFileInfo(mediaPath);
    }

    return readFileDatesFromStat(mediaPath);
  } catch {
    try {
      return readFileDatesFromStat(mediaPath);
    } catch {
      return {
        createdAt: null,
        modifiedAt: null,
        createdAtEpoch: null,
        modifiedAtEpoch: null,
      };
    }
  }
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
