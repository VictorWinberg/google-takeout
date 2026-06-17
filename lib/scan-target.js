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
} from "../timezone-utils.js";
import { readFileDates } from "./media-utils.js";

const DEFAULT_TARGET = resolve("data/target");
const DEFAULT_TAKEOUT = resolve("data/takeout");

export function scanTargetFiles({
  targetRoot = DEFAULT_TARGET,
  takeoutRoot = DEFAULT_TAKEOUT,
} = {}) {
  const resolvedTarget = resolve(targetRoot);
  const resolvedTakeout = resolve(takeoutRoot);
  const index = buildMetadataIndex(resolvedTakeout);
  const mediaFiles = findMediaFiles(resolvedTarget);

  const files = mediaFiles.map((mediaPath) => {
    const relPath = relative(resolvedTarget, mediaPath);
    const fileDates = readFileDates(mediaPath);
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
      };
    }

    return {
      path: relPath,
      hasMetaMatch: false,
      metadataPath: null,
      matchCount: 0,
      ...analyzeMediaFile(mediaPath),
      fileDates,
    };
  });

  return {
    targetRoot: resolvedTarget,
    takeoutRoot: resolvedTakeout,
    total: files.length,
    matched: files.filter((file) => file.hasMetaMatch).length,
    files,
  };
}
