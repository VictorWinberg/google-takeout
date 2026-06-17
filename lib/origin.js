const ORIGIN_TYPE_LABELS = {
  mobileUpload: "Upload",
  webUpload: "Upload",
  fromSharedAlbum: "Shared",
  fromPartnerSharing: "Partner",
};

const ORIGIN_TYPE_TOOLTIPS = {
  mobileUpload: "Mobile upload",
  webUpload: "Web upload",
  fromSharedAlbum: "From shared album",
  fromPartnerSharing: "Partner sharing",
};

function humanizeCamelCase(value) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (char) => char.toUpperCase());
}

function extractOriginDetails(details) {
  if (!details || typeof details !== "object") {
    return [];
  }

  if (details.deviceType) {
    return [String(details.deviceType)];
  }

  return Object.values(details)
    .filter((value) => value != null && value !== "" && typeof value !== "object")
    .map(String);
}

export function parseGooglePhotosOrigin(googlePhotosOrigin) {
  if (!googlePhotosOrigin || typeof googlePhotosOrigin !== "object") {
    return null;
  }

  const entries = Object.entries(googlePhotosOrigin);
  if (entries.length === 0) {
    return null;
  }

  const [type, details] = entries[0];
  const label = ORIGIN_TYPE_LABELS[type] ?? humanizeCamelCase(type);
  const detailParts = extractOriginDetails(details);
  const tooltip =
    detailParts.length > 0
      ? detailParts.join(" · ")
      : (ORIGIN_TYPE_TOOLTIPS[type] ?? humanizeCamelCase(type));

  return { label, tooltip };
}
