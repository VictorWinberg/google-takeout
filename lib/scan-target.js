import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import {
  buildMetadataIndex,
  findMediaFiles,
  findMetadataMatches,
} from "./metadata-index.js";
import {
  analyzeMediaFile,
  analyzePhoto,
  preloadExifTags,
  withExifCache,
} from "../timezone-utils.js";
import { readFileDates } from "./media-utils.js";
import { parseGooglePhotosOrigin } from "./origin.js";
import { DEFAULT_CONCURRENCY } from "./concurrency.js";

const DEFAULT_TARGET = resolve("data/target");
const DEFAULT_TAKEOUT = resolve("data/takeout");

function processMediaFile(mediaPath, {
  resolvedTarget,
  resolvedTakeout,
  index,
}) {
  const relPath = relative(resolvedTarget, mediaPath);
  const fileDates = readFileDates(mediaPath, { fast: true });
  const matches = findMetadataMatches(mediaPath, index);
  const hasMetaMatch = matches.length > 0;

  if (hasMetaMatch) {
    const metadataPath = matches[0];
    let data;
    try {
      data = JSON.parse(readFileSync(metadataPath, "utf8"));
    } catch {
      return {
        path: relPath,
        hasMetaMatch: true,
        metadataPath: relative(resolvedTakeout, metadataPath),
        metadataError: "Invalid JSON",
        fileDates,
        timezones: null,
        photoTaken: null,
        photoTakenEpoch: null,
        origin: null,
      };
    }

    const analysis = analyzePhoto(data, { mediaPath });

    return {
      path: relPath,
      hasMetaMatch: true,
      metadataPath: relative(resolvedTakeout, metadataPath),
      matchCount: matches.length,
      ...analysis,
      fileDates,
      origin: parseGooglePhotosOrigin(data.googlePhotosOrigin),
    };
  }

  return {
    path: relPath,
    hasMetaMatch: false,
    metadataPath: null,
    matchCount: 0,
    ...analyzeMediaFile(mediaPath),
    fileDates,
    origin: null,
  };
}

export async function scanTargetFiles({
  targetRoot = DEFAULT_TARGET,
  takeoutRoot = DEFAULT_TAKEOUT,
  concurrency = DEFAULT_CONCURRENCY,
} = {}) {
  const resolvedTarget = resolve(targetRoot);
  const resolvedTakeout = resolve(takeoutRoot);

  const [index, mediaFiles] = await Promise.all([
    Promise.resolve().then(() => buildMetadataIndex(resolvedTakeout)),
    Promise.resolve().then(() => findMediaFiles(resolvedTarget)),
  ]);

  return withExifCache(async () => {
    await preloadExifTags(mediaFiles, { concurrency });

    const files = mediaFiles.map((mediaPath) =>
      processMediaFile(mediaPath, {
        resolvedTarget,
        resolvedTakeout,
        index,
      }),
    );

    return {
      targetRoot: resolvedTarget,
      takeoutRoot: resolvedTakeout,
      total: files.length,
      matched: files.filter((file) => file.hasMetaMatch).length,
      files,
    };
  });
}
