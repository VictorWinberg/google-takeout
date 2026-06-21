import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

export function StatCard({ label, value }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, minWidth: 120 }}>
      <Typography variant="overline" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" component="p">
        {value}
      </Typography>
    </Paper>
  );
}
