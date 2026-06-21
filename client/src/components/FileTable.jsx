import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import {
  COLUMNS,
  INITIAL_ROW_LIMIT,
  ROW_INCREMENT,
} from "../constants/tableColumns.js";
import { getDateMismatch } from "../utils/dateMismatch.js";
import { canApply } from "../utils/photoTaken.js";
import { getMediaKind } from "../utils/media.js";
import { renderColumnCell } from "./table/columnRenderers.jsx";

export function FileTable({
  title,
  files,
  sortKey,
  sortDir,
  onSort,
  selected,
  onToggleSelected,
  onToggleSelectAll,
  onPreview,
  onPhotoTakenSourceSelect,
  onManualDateChange,
  highlightMismatch = false,
}) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_ROW_LIMIT);
  const visibleFiles = files.slice(0, visibleCount);
  const hasMoreRows = visibleCount < files.length;
  const selectionAnchorRef = useRef(null);

  useEffect(() => {
    setVisibleCount(INITIAL_ROW_LIMIT);
  }, [files]);

  function handleToggleSelected(file, event) {
    if (!canApply(file)) {
      return;
    }

    onToggleSelected({
      path: file.path,
      shiftKey: event.shiftKey,
      visibleFiles,
      anchorPath: selectionAnchorRef.current,
    });
    selectionAnchorRef.current = file.path;
  }

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
        <Table size="small" stickyHeader sx={{ minWidth: 1000 }}>
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
                        onClick={(event) => {
                          event.stopPropagation();
                          event.preventDefault();
                          handleToggleSelected(file, event);
                        }}
                        inputProps={{ "aria-label": `Select ${file.path}` }}
                      />
                    </TableCell>
                    {COLUMNS.map((column) => (
                      <TableCell key={column.key}>
                        {renderColumnCell(file, column.key, {
                          onPhotoTakenSourceSelect,
                          onManualDateChange,
                        })}
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
            Show 500 more ({files.length - visibleCount} remaining)
          </Button>
        </Box>
      )}
    </Box>
  );
}
