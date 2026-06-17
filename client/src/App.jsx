import { useCallback, useEffect, useMemo, useState } from "react";
import RefreshIcon from "@mui/icons-material/Refresh";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".heic",
  ".heif",
]);

const VIDEO_EXTENSIONS = new Set([
  ".mov",
  ".mp4",
  ".m4v",
  ".avi",
  ".mkv",
]);

function mediaUrl(path) {
  return `/api/media?path=${encodeURIComponent(path)}`;
}

function usePreviewSource(previewPath) {
  const [source, setSource] = useState({
    url: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!previewPath) {
      setSource({ url: null, loading: false, error: null });
      return undefined;
    }

    let cancelled = false;
    let objectUrl;

    setSource({ url: null, loading: true, error: null });

    fetch(mediaUrl(previewPath))
      .then(async (response) => {
        const contentType = response.headers.get("content-type") ?? "";

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed to load preview (${response.status})`);
        }

        if (contentType.includes("text/html")) {
          throw new Error(
            "Server returned HTML instead of media. Restart the server and use http://localhost:5173 in dev.",
          );
        }

        return response.blob();
      })
      .then((blob) => {
        if (cancelled) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setSource({ url: objectUrl, loading: false, error: null });
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }

        setSource({ url: null, loading: false, error: err.message });
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [previewPath]);

  return source;
}

function getMediaKind(path) {
  const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  return null;
}

const COLUMNS = [
  { key: "path", label: "File" },
  { key: "createdAt", label: "Created at" },
  { key: "modifiedAt", label: "Modified at" },
  { key: "hasMetaMatch", label: "Meta match" },
  { key: "origin", label: "Origin" },
  { key: "photoTakenMetadata", label: "Photo taken (metadata)" },
  { key: "photoTakenExif", label: "Photo taken (exif)" },
];

function getPhotoTakenSource(file) {
  if (file.photoTakenSource) {
    return file.photoTakenSource;
  }

  const hasMetadata = file.photoTaken?.metadata != null;
  const hasExif = file.photoTaken?.exif != null;
  const metadataHasTimezone = file.photoTaken?.metadataTimezone != null;
  const exifHasTimezone = file.photoTaken?.exifTimezone != null;

  if (metadataHasTimezone && hasMetadata) {
    return "metadata";
  }

  if (exifHasTimezone && hasExif) {
    return "exif";
  }

  if (hasExif) {
    return "exif";
  }

  if (hasMetadata) {
    return "metadata";
  }

  return null;
}

function getChosenPhotoTakenReference(file) {
  const source = getPhotoTakenSource(file);

  if (source === "metadata") {
    return {
      display: file.photoTaken?.metadata ?? null,
      epoch: file.photoTakenEpoch ?? null,
    };
  }

  if (source === "exif") {
    return {
      display: file.photoTaken?.exif ?? null,
      epoch: file.photoTakenEpoch ?? null,
    };
  }

  return { display: null, epoch: null };
}

function formatPhotoTakenTimezone({ source, value }) {
  return `${source}: ${value}`;
}

function getMetadataTimezoneInfo(file) {
  if (file.photoTaken?.metadataTimezone) {
    return file.photoTaken.metadataTimezone;
  }

  if (!file.photoTaken?.metadata || !file.timezones) {
    return null;
  }

  const { coordinates, filename, exif, exifDatetime } = file.timezones;
  if (coordinates) return { source: "coordinates", value: coordinates };
  if (filename) return { source: "filename", value: filename };
  if (exif) return { source: "exif", value: exif };
  if (exifDatetime) return { source: "exif datetime", value: exifDatetime };
  return null;
}

function getExifTimezoneInfo(file) {
  if (file.photoTaken?.exifTimezone) {
    return file.photoTaken.exifTimezone;
  }

  if (!file.photoTaken?.exif || !file.timezones?.exif) {
    return null;
  }

  return { source: "exif", value: file.timezones.exif };
}

function PhotoTakenCell({ value, timezoneInfo, highlighted = false }) {
  if (value == null || value === "") {
    return <CellValue value={null} />;
  }

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

  if (!timezoneInfo) {
    if (highlighted) {
      return (
        <Typography variant="body2" sx={highlightSx}>
          {value}
        </Typography>
      );
    }

    return <CellValue value={value} />;
  }

  return (
    <Tooltip
      title={
        highlighted
          ? `Used for apply · ${formatPhotoTakenTimezone(timezoneInfo)}`
          : formatPhotoTakenTimezone(timezoneInfo)
      }
      placement="top"
      arrow
    >
      <Box
        component="span"
        onClick={(event) => event.stopPropagation()}
        sx={{
          display: "inline-block",
          cursor: "help",
          borderBottom: highlighted ? "none" : "1px dotted",
          borderColor: "text.secondary",
          ...highlightSx,
        }}
      >
        {value}
      </Box>
    </Tooltip>
  );
}

function OriginCell({ origin }) {
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

function canApply(file) {
  return file.photoTakenEpoch != null;
}

const DATE_MATCH_TOLERANCE_SECONDS = 60;

function epochsMatchWithinTolerance(epoch, referenceEpoch) {
  if (epoch == null || referenceEpoch == null) {
    return false;
  }

  return Math.abs(epoch - referenceEpoch) <= DATE_MATCH_TOLERANCE_SECONDS;
}

function fileDateMatchesReference({ display, epoch }, referenceDisplay, referenceEpoch) {
  if (referenceDisplay != null && display === referenceDisplay) {
    return true;
  }

  return epochsMatchWithinTolerance(epoch, referenceEpoch);
}

function getDateMismatch(file) {
  const { display: referenceDisplay, epoch: referenceEpoch } =
    getChosenPhotoTakenReference(file);

  if (referenceDisplay == null && referenceEpoch == null) {
    return { hasMismatch: false, createdMismatch: false, modifiedMismatch: false };
  }

  const createdMatches = fileDateMatchesReference(
    {
      display: file.fileDates?.createdAt ?? null,
      epoch: file.fileDates?.createdAtEpoch ?? null,
    },
    referenceDisplay,
    referenceEpoch,
  );
  const modifiedMatches = fileDateMatchesReference(
    {
      display: file.fileDates?.modifiedAt ?? null,
      epoch: file.fileDates?.modifiedAtEpoch ?? null,
    },
    referenceDisplay,
    referenceEpoch,
  );

  return {
    hasMismatch: !(createdMatches && modifiedMatches),
    createdMismatch: !createdMatches,
    modifiedMismatch: !modifiedMatches,
  };
}

function CellValue({ value }) {
  if (value == null || value === "") {
    return (
      <Typography component="span" color="text.disabled">
        —
      </Typography>
    );
  }

  return value;
}

function getCellValue(file, key) {
  switch (key) {
    case "photoTakenMetadata":
      return file.photoTaken?.metadata;
    case "photoTakenExif":
      return file.photoTaken?.exif;
    case "createdAt":
      return file.fileDates?.createdAt;
    case "modifiedAt":
      return file.fileDates?.modifiedAt;
    default:
      return null;
  }
}

function renderColumnCell(file, key) {
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

    if (file.metadataPath) {
      return (
        <Tooltip title={file.metadataPath} placement="top" arrow>
          <Box component="span" sx={{ display: "inline-flex" }}>
            {chip}
          </Box>
        </Tooltip>
      );
    }

    return chip;
  }

  if (key === "origin") {
    return <OriginCell origin={file.origin} />;
  }

  if (key === "photoTakenMetadata") {
    return (
      <PhotoTakenCell
        value={file.photoTaken?.metadata}
        timezoneInfo={getMetadataTimezoneInfo(file)}
        highlighted={usedSource === "metadata"}
      />
    );
  }

  if (key === "photoTakenExif") {
    return (
      <PhotoTakenCell
        value={file.photoTaken?.exif}
        timezoneInfo={getExifTimezoneInfo(file)}
        highlighted={usedSource === "exif"}
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

function sortValue(file, key) {
  switch (key) {
    case "path":
      return file.path;
    case "hasMetaMatch":
      return file.hasMetaMatch ? 1 : 0;
    case "origin":
      return file.origin?.label ?? "";
    case "photoTakenMetadata":
      return file.photoTaken?.metadata ?? "";
    case "photoTakenExif":
      return file.photoTaken?.exif ?? "";
    case "createdAt":
      return file.fileDates?.createdAtEpoch ?? "";
    case "modifiedAt":
      return file.fileDates?.modifiedAtEpoch ?? "";
    default:
      return "";
  }
}

function StatCard({ label, value }) {
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

const INITIAL_ROW_LIMIT = 200;
const ROW_INCREMENT = 100;

function FileTable({
  title,
  files,
  sortKey,
  sortDir,
  onSort,
  selected,
  onToggleSelected,
  onToggleSelectAll,
  onPreview,
  highlightMismatch = false,
}) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_ROW_LIMIT);
  const visibleFiles = files.slice(0, visibleCount);
  const hasMoreRows = visibleCount < files.length;

  useEffect(() => {
    setVisibleCount(INITIAL_ROW_LIMIT);
  }, [files]);

  const selectableFiles = files.filter(canApply);
  const allSelectableSelected =
    selectableFiles.length > 0 &&
    selectableFiles.every((file) => selected.has(file.path));
  const someSelectableSelected =
    selectableFiles.some((file) => selected.has(file.path)) &&
    !allSelectableSelected;

  return (
    <Box>
      <Typography variant="h6" component="h2" gutterBottom>
        {title} ({files.length})
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
        <Table size="small" stickyHeader sx={{ minWidth: 960 }}>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={allSelectableSelected}
                  indeterminate={someSelectableSelected}
                  disabled={selectableFiles.length === 0}
                  onChange={() => onToggleSelectAll(files)}
                  inputProps={{ "aria-label": `Select all in ${title}` }}
                />
              </TableCell>
              {COLUMNS.map((column) => (
                <TableCell
                  key={column.key}
                  sortDirection={sortKey === column.key ? sortDir : false}
                >
                  <TableSortLabel
                    active={sortKey === column.key}
                    direction={sortKey === column.key ? sortDir : "asc"}
                    onClick={() => onSort(column.key)}
                  >
                    {column.label}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {files.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNS.length + 1}>No files in this section.</TableCell>
              </TableRow>
            ) : (
              visibleFiles.map((file) => {
                const applicable = canApply(file);
                const isSelected = selected.has(file.path);
                const canPreview = getMediaKind(file.path) != null;
                const dateMismatch = getDateMismatch(file);

                return (
                  <TableRow
                    key={file.path}
                    hover={canPreview}
                    selected={isSelected}
                    onClick={() => {
                      if (canPreview) {
                        onPreview(file.path);
                      }
                    }}
                    sx={{
                      cursor: canPreview ? "pointer" : "default",
                      opacity: applicable ? 1 : 0.55,
                      ...(highlightMismatch &&
                        dateMismatch.hasMismatch && {
                          bgcolor: (theme) => alpha(theme.palette.warning.main, 0.08),
                        }),
                    }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isSelected}
                        disabled={!applicable}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => onToggleSelected(file.path)}
                        inputProps={{ "aria-label": `Select ${file.path}` }}
                      />
                    </TableCell>
                    {COLUMNS.map((column) => (
                      <TableCell key={column.key}>
                        {renderColumnCell(file, column.key)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {hasMoreRows && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
          <Button
            variant="outlined"
            onClick={() =>
              setVisibleCount((count) => Math.min(count + ROW_INCREMENT, files.length))
            }
          >
            Show 100 more ({files.length - visibleCount} remaining)
          </Button>
        </Box>
      )}
    </Box>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [matchFilter, setMatchFilter] = useState("all");
  const [sortKey, setSortKey] = useState("path");
  const [sortDir, setSortDir] = useState("asc");
  const [selected, setSelected] = useState(new Set());
  const [applying, setApplying] = useState(false);
  const [applyNotice, setApplyNotice] = useState(null);
  const [previewPath, setPreviewPath] = useState(null);

  const previewKind = previewPath ? getMediaKind(previewPath) : null;
  const previewSource = usePreviewSource(previewPath);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/files");
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${response.status})`);
      }

      setData(await response.json());
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredFiles = useMemo(() => {
    if (!data?.files) return [];

    const normalizedQuery = query.trim().toLowerCase();

    return data.files
      .filter((file) => {
        if (matchFilter === "matched" && !file.hasMetaMatch) return false;
        if (matchFilter === "unmatched" && file.hasMetaMatch) return false;

        if (!normalizedQuery) return true;

        const haystack = [
          file.path,
          file.metadataPath,
          file.origin?.label,
          file.origin?.tooltip,
          file.photoTaken?.metadataTimezone?.value,
          file.photoTaken?.metadataTimezone?.source,
          file.photoTaken?.exifTimezone?.value,
          file.photoTaken?.exifTimezone?.source,
          file.photoTaken?.metadata,
          file.photoTaken?.exif,
          file.fileDates?.createdAt,
          file.fileDates?.modifiedAt,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedQuery);
      })
      .sort((a, b) => {
        const left = sortValue(a, sortKey);
        const right = sortValue(b, sortKey);
        const cmp =
          typeof left === "number" && typeof right === "number"
            ? left - right
            : String(left).localeCompare(String(right), undefined, {
                sensitivity: "base",
              });

        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [data, query, matchFilter, sortKey, sortDir]);

  const mismatchFiles = useMemo(
    () => filteredFiles.filter((file) => getDateMismatch(file).hasMismatch),
    [filteredFiles],
  );

  const matchedFiles = useMemo(
    () => filteredFiles.filter((file) => !getDateMismatch(file).hasMismatch),
    [filteredFiles],
  );

  const selectableFiles = useMemo(
    () => filteredFiles.filter(canApply),
    [filteredFiles],
  );

  const allSelectableSelected =
    selectableFiles.length > 0 &&
    selectableFiles.every((file) => selected.has(file.path));

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDir("asc");
  }

  function toggleSelected(path) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelectableSelected) {
      setSelected((current) => {
        const next = new Set(current);
        for (const file of selectableFiles) {
          next.delete(file.path);
        }
        return next;
      });
      return;
    }

    setSelected((current) => {
      const next = new Set(current);
      for (const file of selectableFiles) {
        next.add(file.path);
      }
      return next;
    });
  }

  function toggleSelectAllInTable(files) {
    const tableSelectable = files.filter(canApply);
    const allSelected =
      tableSelectable.length > 0 &&
      tableSelectable.every((file) => selected.has(file.path));

    setSelected((current) => {
      const next = new Set(current);
      for (const file of tableSelectable) {
        if (allSelected) {
          next.delete(file.path);
        } else {
          next.add(file.path);
        }
      }
      return next;
    });
  }

  async function applySelected() {
    const paths = [...selected];
    if (paths.length === 0) return;

    setApplying(true);
    setApplyNotice(null);

    try {
      const response = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error ?? `Apply failed (${response.status})`);
      }

      const failed = body.results?.filter((result) => !result.ok) ?? [];
      if (failed.length > 0) {
        setApplyNotice({
          severity: "warning",
          message: `Applied ${body.applied} file(s), ${body.failed} failed: ${failed.map((result) => `${result.path} (${result.error})`).join("; ")}`,
        });
      } else {
        setApplyNotice({
          severity: "success",
          message: `Applied photo taken time to ${body.applied} file(s).`,
        });
        setSelected(new Set());
        await loadData();
      }
    } catch (err) {
      setApplyNotice({ severity: "error", message: err.message });
    } finally {
      setApplying(false);
    }
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Target file metadata
          </Typography>
          <Typography color="text.secondary">
            All media in <Box component="code">data/target</Box>, matched against
            takeout metadata and photo times from each source. Select files and
            apply to set Date Created and Date Modified.
          </Typography>
        </Box>

        {data && (
          <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
            <StatCard label="Total files" value={data.total} />
            <StatCard label="Metadata matched" value={data.matched} />
            <StatCard
              label="Date mismatches"
              value={data.files.filter((file) => getDateMismatch(file).hasMismatch).length}
            />
            <StatCard
              label="Dates matched"
              value={data.files.filter((file) => !getDateMismatch(file).hasMismatch).length}
            />
          </Stack>
        )}

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          useFlexGap
          flexWrap="wrap"
          alignItems={{ md: "center" }}
        >
          <TextField
            size="small"
            type="search"
            label="Search"
            placeholder="Path, metadata, times…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            sx={{ flex: "1 1 240px" }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="match-filter-label">Filter</InputLabel>
            <Select
              labelId="match-filter-label"
              label="Filter"
              value={matchFilter}
              onChange={(event) => setMatchFilter(event.target.value)}
            >
              <MenuItem value="all">All files</MenuItem>
              <MenuItem value="matched">Metadata matched only</MenuItem>
              <MenuItem value="unmatched">Metadata unmatched only</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadData}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
          <Button
            variant="outlined"
            onClick={toggleSelectAll}
            disabled={selectableFiles.length === 0}
          >
            {allSelectableSelected ? "Deselect all" : "Select all"}
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={applySelected}
            disabled={applying || selected.size === 0}
          >
            {applying ? "Applying…" : `Apply (${selected.size})`}
          </Button>
          {selected.size > 0 && (
            <Typography variant="body2" color="text.secondary">
              {selected.size} selected
            </Typography>
          )}
        </Stack>

        {applyNotice && (
          <Alert severity={applyNotice.severity} onClose={() => setApplyNotice(null)}>
            {applyNotice.message}
          </Alert>
        )}

        {error && <Alert severity="error">{error}</Alert>}

        {loading && !data && (
          <Stack direction="row" spacing={2} alignItems="center">
            <CircularProgress size={24} />
            <Typography color="text.secondary">Scanning target files…</Typography>
          </Stack>
        )}

        {data && (
          <Stack spacing={4}>
            <FileTable
              title="Date mismatches"
              files={mismatchFiles}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={toggleSort}
              selected={selected}
              onToggleSelected={toggleSelected}
              onToggleSelectAll={toggleSelectAllInTable}
              onPreview={setPreviewPath}
              highlightMismatch
            />
            <FileTable
              title="Dates matched"
              files={matchedFiles}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={toggleSort}
              selected={selected}
              onToggleSelected={toggleSelected}
              onToggleSelectAll={toggleSelectAllInTable}
              onPreview={setPreviewPath}
            />
          </Stack>
        )}
      </Stack>

      <Dialog
        open={previewPath != null}
        onClose={() => setPreviewPath(null)}
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
    </Container>
  );
}
