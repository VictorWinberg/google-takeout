import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export function PreviewDialog({
  previewPath,
  previewKind,
  previewSource,
  onClose,
}) {
  return (
    <Dialog
      open={previewPath != null}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle sx={{ fontFamily: "monospace", wordBreak: "break-all" }}>
        {previewPath}
      </DialogTitle>
      <DialogContent dividers sx={{ display: "flex", justifyContent: "center", p: 2 }}>
        {previewSource.loading && (
          <Stack direction="row" spacing={2} alignItems="center">
            <CircularProgress size={24} />
            <Typography color="text.secondary">Loading preview…</Typography>
          </Stack>
        )}
        {previewSource.error && (
          <Alert severity="error" sx={{ width: "100%" }}>
            {previewSource.error}
          </Alert>
        )}
        {previewSource.url && previewKind === "image" && (
          <Box
            component="img"
            key={previewPath}
            src={previewSource.url}
            alt={previewPath}
            sx={{
              maxWidth: "100%",
              maxHeight: "75vh",
              objectFit: "contain",
            }}
          />
        )}
        {previewSource.url && previewKind === "video" && (
          <Box
            component="video"
            key={previewPath}
            src={previewSource.url}
            controls
            sx={{
              maxWidth: "100%",
              maxHeight: "75vh",
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
