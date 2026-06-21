import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import { CellValue } from "./CellValue.jsx";

export function OriginCell({ origin }) {
  if (!origin?.label) {
    return <CellValue value={null} />;
  }

  if (!origin.tooltip) {
    return <CellValue value={origin.label} />;
  }

  return (
    <Tooltip title={origin.tooltip} placement="top" arrow>
      <Box
        component="span"
        onClick={(event) => event.stopPropagation()}
        sx={{
          display: "inline-block",
          cursor: "help",
          borderBottom: "1px dotted",
          borderColor: "text.secondary",
        }}
      >
        {origin.label}
      </Box>
    </Tooltip>
  );
}
