import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS } from "../constants/media.js";

export function mediaUrl(path) {
  return `/api/media?path=${encodeURIComponent(path)}`;
}

export function getMediaKind(path) {
  const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  return null;
}
