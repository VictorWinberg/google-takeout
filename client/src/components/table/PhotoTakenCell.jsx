import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import { alpha } from "@mui/material/styles";
import { formatPhotoTakenTimezone } from "../../utils/photoTaken.js";
import { CellValue } from "./CellValue.jsx";

export function PhotoTakenCell({
  value,
  timezoneInfo,
  highlighted = false,
  selectable = false,
  onSelect,
}) {
  if (value == null || value === "") {
    return <CellValue value={null} />;
  }

  const canSelect = selectable && !highlighted && onSelect;

  const highlightSx = highlighted
    ? {
        color: "primary.main",
        fontWeight: 700,
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
        px: 0.75,
        py: 0.25,
        borderRadius: 0.5,
      }
    : {};

  const tooltipTitle = highlighted
    ? `Used for apply · ${timezoneInfo ? formatPhotoTakenTimezone(timezoneInfo) : value}`
    : canSelect
      ? `Click to use for apply${timezoneInfo ? ` · ${formatPhotoTakenTimezone(timezoneInfo)}` : ""}`
      : timezoneInfo
        ? formatPhotoTakenTimezone(timezoneInfo)
        : value;

  const content = (
    <Box
      component="span"
      onClick={(event) => {
        event.stopPropagation();
        if (canSelect) {
          onSelect();
        }
      }}
      sx={{
        display: "inline-block",
        cursor: canSelect ? "pointer" : highlighted ? "default" : "help",
        borderBottom: highlighted || canSelect ? "none" : "1px dotted",
        borderColor: "text.secondary",
        ...highlightSx,
        ...(canSelect && {
          "&:hover": {
            color: "primary.main",
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
            px: 0.75,
            py: 0.25,
            borderRadius: 0.5,
          },
        }),
      }}
    >
      {value}
    </Box>
  );

  if (!timezoneInfo && !canSelect && !highlighted) {
    return <CellValue value={value} />;
  }

  return (
    <Tooltip title={tooltipTitle} placement="top" arrow>
      {content}
    </Tooltip>
  );
}
