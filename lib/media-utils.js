import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { normalizeEpochSeconds } from "./epoch-utils.js";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const VIDEO_EXTENSIONS = new Set([
  ".mov", ".mp4", ".m4v", ".avi", ".mkv",
]);

const PHOTO_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".heic", ".heif", ".webp",
]);

export function getMediaKind(filename) {
  const ext = extname(basename(filename)).toLowerCase();
  if (VIDEO_EXTENSIONS.has(ext)) {
    return "video";
  }
  if (PHOTO_EXTENSIONS.has(ext)) {
    return "photo";
  }
  return null;
}

export function mediaMatchKey(filename) {
  let name = basename(filename);

  const extension = extname(name);
  const kind = extension ? getMediaKind(name) : null;
  if (extension) {
    name = name.slice(0, -extension.length);
  }

  name = name.replace(/\s*\(\d+[a-zA-Z]?\)[a-zA-Z]?$/, "");
  name = name.toLowerCase();

  return kind ? `${name}:${kind}` : name;
}

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

  const key = mediaMatchKey(mediaName);
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
          const key = mediaMatchKey(entry.name);
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
  if (!Number.isFinite(date.getTime())) {
    return null;
  }

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
    modifiedAtEpoch: Number.isFinite(modifiedAt.getTime())
      ? Math.floor(modifiedAt.getTime() / 1000)
      : null,
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

export function readFileDates(mediaPath, { fast = false } = {}) {
  try {
    if (!fast && process.platform === "darwin") {
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
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Invalid date");
  }

  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");

  return `${mm}/${dd}/${yyyy} ${hh}:${min}:${ss}`;
}

const execFileAsync = promisify(execFile);

function buildSetFileDateArgs(epochSeconds) {
  const normalizedEpoch = normalizeEpochSeconds(epochSeconds);
  if (normalizedEpoch == null) {
    throw new Error("Invalid epoch");
  }

  const date = new Date(normalizedEpoch * 1000);
  const setFileDate = formatSetFileDate(date);
  return ["-d", setFileDate, "-m", setFileDate];
}

export function setFileDates(mediaPath, epochSeconds) {
  execFileSync("SetFile", [...buildSetFileDateArgs(epochSeconds), mediaPath]);
}

export async function setFileDatesAsync(mediaPath, epochSeconds) {
  await execFileAsync("SetFile", [...buildSetFileDateArgs(epochSeconds), mediaPath]);
}
