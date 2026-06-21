import { useState } from "react";
import dayjs from "dayjs";
import EventIcon from "@mui/icons-material/Event";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import Tooltip from "@mui/material/Tooltip";
import { StaticDateTimePicker } from "@mui/x-date-pickers/StaticDateTimePicker";
import { alpha } from "@mui/material/styles";
import { getPhotoTakenEpochForSource } from "../../utils/photoTaken.js";

export function ManualPhotoTakenCell({ file, highlighted, onManualDateChange, onSelect }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const manualEpoch = getPhotoTakenEpochForSource(file, "manual");
  const manualDisplay = file.photoTaken?.manual;
  const pickerValue = manualEpoch != null ? dayjs.unix(manualEpoch) : null;
  const open = Boolean(anchorEl);

  const tooltipTitle = manualDisplay
    ? highlighted
      ? `Used for apply · ${manualDisplay}`
      : manualDisplay
    : "Set manual date";

  function handleOpen(event) {
    event.stopPropagation();
    if (manualEpoch != null && !highlighted) {
      onSelect?.();
    }
    setAnchorEl(event.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  return (
    <Box onClick={(event) => event.stopPropagation()}>
      <Tooltip title={tooltipTitle} placement="top" arrow>
        <IconButton
          size="small"
          onClick={handleOpen}
          aria-label={tooltipTitle}
          color={highlighted ? "primary" : "default"}
          sx={
            highlighted
              ? {
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                }
              : undefined
          }
        >
          <EventIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        onClick={(event) => event.stopPropagation()}
      >
        <StaticDateTimePicker
          ampm={false}
          views={["year", "month", "day", "hours", "minutes", "seconds"]}
          format="D MMM YYYY, HH:mm:ss"
          value={pickerValue}
          onChange={(newValue) => {
            onManualDateChange(file.path, newValue);
            if (newValue == null) {
              handleClose();
            }
          }}
          onAccept={handleClose}
          slotProps={{
            actionBar: { actions: ["clear", "accept"] },
          }}
        />
      </Popover>
    </Box>
  );
}
