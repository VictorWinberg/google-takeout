import Typography from "@mui/material/Typography";

export function CellValue({ value }) {
  if (value == null || value === "") {
    return (
      <Typography component="span" color="text.disabled">
        —
      </Typography>
    );
  }

  return value;
}
