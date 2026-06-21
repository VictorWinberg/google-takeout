import { useCallback, useEffect, useMemo, useState } from "react";
import RefreshIcon from "@mui/icons-material/Refresh";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { FileTable } from "./components/FileTable.jsx";
import { PreviewDialog } from "./components/PreviewDialog.jsx";
import { StatCard } from "./components/StatCard.jsx";
import { sortValue } from "./components/table/columnRenderers.jsx";
import { usePreviewSource } from "./hooks/usePreviewSource.js";
import { mergeApplyResults } from "./utils/applyResults.js";
import { getDateMismatch } from "./utils/dateMismatch.js";
import {
  formatFileDateFromEpoch,
  isValidEpochSeconds,
} from "./utils/dates.js";
import { getMediaKind } from "./utils/media.js";
import {
  canApply,
  getDefaultPhotoTakenSelection,
  getPhotoTakenEpoch,
  getPhotoTakenEpochForSource,
} from "./utils/photoTaken.js";

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
          file.photoTaken?.filenameTimezone?.value,
          file.photoTaken?.filenameTimezone?.source,
          file.photoTaken?.metadataTimezone?.value,
          file.photoTaken?.metadataTimezone?.source,
          file.photoTaken?.exifTimezone?.value,
          file.photoTaken?.exifTimezone?.source,
          file.photoTaken?.filename,
          file.photoTaken?.metadata,
          file.photoTaken?.exif,
          file.photoTaken?.manual,
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
    () => filteredFiles.filter((file) => getDateMismatch(file).hasDateMatch),
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

  function toggleSelected({ path, shiftKey = false, visibleFiles = null, anchorPath = null }) {
    setSelected((current) => {
      const next = new Set(current);

      if (shiftKey && anchorPath != null && visibleFiles?.length) {
        const paths = visibleFiles.map((file) => file.path);
        const start = paths.indexOf(anchorPath);
        const end = paths.indexOf(path);

        if (start !== -1 && end !== -1) {
          const from = Math.min(start, end);
          const to = Math.max(start, end);

          for (let index = from; index <= to; index += 1) {
            const file = visibleFiles[index];
            if (canApply(file)) {
              next.add(file.path);
            }
          }

          return next;
        }
      }

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

  function setManualPhotoTaken(path, dayjsValue) {
    setData((prev) => {
      if (!prev?.files) {
        return prev;
      }

      return {
        ...prev,
        files: prev.files.map((file) => {
          if (file.path !== path) {
            return file;
          }

          if (dayjsValue == null || !dayjsValue.isValid()) {
            const { source, epoch } = getDefaultPhotoTakenSelection(file);
            const nextPhotoTaken = { ...file.photoTaken };
            delete nextPhotoTaken.manual;

            const nextEpochs = { ...file.photoTakenEpochs };
            delete nextEpochs.manual;

            return {
              ...file,
              photoTakenSource: source,
              photoTakenEpoch: epoch,
              photoTaken: Object.keys(nextPhotoTaken).length > 0 ? nextPhotoTaken : null,
              photoTakenEpochs: Object.keys(nextEpochs).length > 0 ? nextEpochs : null,
            };
          }

          const epoch = Math.floor(dayjsValue.valueOf() / 1000);
          const display = formatFileDateFromEpoch(epoch);
          if (!isValidEpochSeconds(epoch) || display == null) {
            return file;
          }

          return {
            ...file,
            photoTakenSource: "manual",
            photoTakenEpoch: epoch,
            photoTaken: {
              ...file.photoTaken,
              manual: display,
            },
            photoTakenEpochs: {
              ...file.photoTakenEpochs,
              manual: epoch,
            },
          };
        }),
      };
    });
  }

  function selectPhotoTakenSource(path, source) {
    setData((prev) => {
      if (!prev?.files) {
        return prev;
      }

      return {
        ...prev,
        files: prev.files.map((file) => {
          if (file.path !== path) {
            return file;
          }

          const epoch = getPhotoTakenEpochForSource(file, source);
          if (!isValidEpochSeconds(epoch)) {
            return file;
          }

          return {
            ...file,
            photoTakenSource: source,
            photoTakenEpoch: epoch,
          };
        }),
      };
    });
  }

  async function applySelected() {
    const paths = [...selected];
    if (paths.length === 0) return;

    setApplying(true);
    setApplyNotice(null);

    const photoTakenEpochs = Object.fromEntries(
      paths
        .map((path) => {
          const file = data?.files?.find((entry) => entry.path === path);
          if (!file) {
            return null;
          }

          return [path, getPhotoTakenEpoch(file)];
        })
        .filter((entry) => entry && isValidEpochSeconds(entry[1])),
    );

    try {
      const response = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths, photoTakenEpochs }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error ?? `Apply failed (${response.status})`);
      }

      const successful = body.results?.filter((result) => result.ok) ?? [];
      const failed = body.results?.filter((result) => !result.ok) ?? [];

      if (successful.length > 0) {
        setData((prev) => mergeApplyResults(prev, successful));
      }

      if (failed.length > 0) {
        setApplyNotice({
          severity: "warning",
          message: `Applied ${body.applied} file(s), ${body.failed} failed: ${failed.map((result) => `${result.path} (${result.error})`).join("; ")}`,
        });
        setSelected((current) => {
          const next = new Set(current);
          for (const result of successful) {
            next.delete(result.path);
          }
          return next;
        });
      } else {
        setApplyNotice({
          severity: "success",
          message: `Applied photo taken time to ${body.applied} file(s).`,
        });
        setSelected(new Set());
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
            takeout metadata and photo times from each source. Click a photo taken
            date to choose which source to use, or set a manual date in the picker,
            then select files and apply to set Date Created and Date Modified.
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
              value={data.files.filter((file) => getDateMismatch(file).hasDateMatch).length}
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
              onPhotoTakenSourceSelect={selectPhotoTakenSource}
              onManualDateChange={setManualPhotoTaken}
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
              onPhotoTakenSourceSelect={selectPhotoTakenSource}
              onManualDateChange={setManualPhotoTaken}
            />
          </Stack>
        )}
      </Stack>

      <PreviewDialog
        previewPath={previewPath}
        previewKind={previewKind}
        previewSource={previewSource}
        onClose={() => setPreviewPath(null)}
      />
    </Container>
  );
}
