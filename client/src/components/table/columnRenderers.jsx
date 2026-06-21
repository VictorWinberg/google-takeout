import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { getDateMismatch } from "../../utils/dateMismatch.js";
import { isValidEpochSeconds } from "../../utils/dates.js";
import {
  getExifTimezoneInfo,
  getFilenameTimezoneInfo,
  getMetadataTimezoneInfo,
  getPhotoTakenEpochForSource,
  getPhotoTakenSource,
} from "../../utils/photoTaken.js";
import { CellValue } from "./CellValue.jsx";
import { ManualPhotoTakenCell } from "./ManualPhotoTakenCell.jsx";
import { OriginCell } from "./OriginCell.jsx";
import { PhotoTakenCell } from "./PhotoTakenCell.jsx";

function getCellValue(file, key) {
  switch (key) {
    case "photoTakenFilename":
      return file.photoTaken?.filename;
    case "photoTakenMetadata":
      return file.photoTaken?.metadata;
    case "photoTakenExif":
      return file.photoTaken?.exif;
    case "photoTakenManual":
      return file.photoTaken?.manual;
    case "createdAt":
      return file.fileDates?.createdAt;
    case "modifiedAt":
      return file.fileDates?.modifiedAt;
    default:
      return null;
  }
}

export function renderColumnCell(file, key, { onPhotoTakenSourceSelect, onManualDateChange } = {}) {
  const dateMismatch = getDateMismatch(file);
  const usedSource = getPhotoTakenSource(file);

  if (key === "path") {
    return (
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{ fontFamily: "monospace", wordBreak: "break-all" }}
        >
          {file.path}
        </Typography>
        {file.metadataError && (
          <Typography variant="caption" color="error" display="block">
            {file.metadataError}
          </Typography>
        )}
      </Box>
    );
  }

  if (key === "hasMetaMatch") {
    const chip = (
      <Chip
        size="small"
        label={file.hasMetaMatch ? "Yes" : "No"}
        color={file.hasMetaMatch ? "success" : "error"}
        variant="outlined"
      />
    );

    const conflictNames = file.metadataConflictNames ?? [];
    const conflictTooltip =
      conflictNames.length > 0
        ? `Multiple metadata files with different photo taken times: ${conflictNames.join(", ")}`
        : "";

    const content = (
      <Stack direction="row" spacing={0.5} alignItems="center" component="span">
        {chip}
        {file.metadataConflict && (
          <Tooltip title={conflictTooltip} placement="top" arrow>
            <WarningAmberIcon
              color="warning"
              sx={{ fontSize: 18, cursor: "help" }}
              aria-label="Conflicting metadata files"
            />
          </Tooltip>
        )}
      </Stack>
    );

    if (file.metadataPath) {
      return (
        <Tooltip title={file.metadataPath} placement="top" arrow>
          <Box component="span" sx={{ display: "inline-flex" }}>
            {content}
          </Box>
        </Tooltip>
      );
    }

    return content;
  }

  if (key === "origin") {
    return <OriginCell origin={file.origin} />;
  }

  if (key === "photoTakenFilename") {
    return (
      <PhotoTakenCell
        value={file.photoTaken?.filename}
        timezoneInfo={getFilenameTimezoneInfo(file)}
        highlighted={usedSource === "filename"}
        selectable={isValidEpochSeconds(getPhotoTakenEpochForSource(file, "filename"))}
        onSelect={() => onPhotoTakenSourceSelect?.(file.path, "filename")}
      />
    );
  }

  if (key === "photoTakenMetadata") {
    return (
      <PhotoTakenCell
        value={file.photoTaken?.metadata}
        timezoneInfo={getMetadataTimezoneInfo(file)}
        highlighted={usedSource === "metadata"}
        selectable={isValidEpochSeconds(getPhotoTakenEpochForSource(file, "metadata"))}
        onSelect={() => onPhotoTakenSourceSelect?.(file.path, "metadata")}
      />
    );
  }

  if (key === "photoTakenExif") {
    return (
      <PhotoTakenCell
        value={file.photoTaken?.exif}
        timezoneInfo={getExifTimezoneInfo(file)}
        highlighted={usedSource === "exif"}
        selectable={isValidEpochSeconds(getPhotoTakenEpochForSource(file, "exif"))}
        onSelect={() => onPhotoTakenSourceSelect?.(file.path, "exif")}
      />
    );
  }

  if (key === "photoTakenManual") {
    return (
      <ManualPhotoTakenCell
        file={file}
        highlighted={usedSource === "manual"}
        onManualDateChange={onManualDateChange}
        onSelect={() => onPhotoTakenSourceSelect?.(file.path, "manual")}
      />
    );
  }

  if (key === "createdAt" && dateMismatch.createdMismatch) {
    return (
      <Typography variant="body2" color="warning.main" fontWeight={600}>
        {getCellValue(file, key) ?? "—"}
      </Typography>
    );
  }

  if (key === "modifiedAt" && dateMismatch.modifiedMismatch) {
    return (
      <Typography variant="body2" color="warning.main" fontWeight={600}>
        {getCellValue(file, key) ?? "—"}
      </Typography>
    );
  }

  return <CellValue value={getCellValue(file, key)} />;
}

export function sortValue(file, key) {
  switch (key) {
    case "path":
      return file.path;
    case "hasMetaMatch":
      return file.hasMetaMatch ? 1 : 0;
    case "origin":
      return file.origin?.label ?? "";
    case "photoTakenFilename":
      return file.photoTaken?.filename ?? "";
    case "photoTakenMetadata":
      return file.photoTaken?.metadata ?? "";
    case "photoTakenExif":
      return file.photoTaken?.exif ?? "";
    case "photoTakenManual":
      return file.photoTaken?.manual ?? "";
    case "createdAt":
      return file.fileDates?.createdAtEpoch ?? "";
    case "modifiedAt":
      return file.fileDates?.modifiedAtEpoch ?? "";
    default:
      return "";
  }
}
