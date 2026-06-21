import express from "express";
import { existsSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { applyPhotoTakenTimes } from "../lib/apply-dates.js";
import { scanTargetFiles } from "../lib/scan-target.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");
const PORT = Number(process.env.PORT) || 3001;
const TARGET_ROOT = resolve(process.env.TARGET_ROOT ?? join(ROOT, "data/target"));
const TAKEOUT_ROOT = resolve(process.env.TAKEOUT_ROOT ?? join(ROOT, "data/takeout"));

function resolveTargetFile(relPath) {
  const fullPath = resolve(TARGET_ROOT, relPath);
  const relativePath = relative(TARGET_ROOT, fullPath);

  if (relativePath.startsWith("..") || relativePath.includes(`..${sep}`)) {
    return null;
  }

  return fullPath;
}

function normalizeMediaPath(rawPath) {
  if (typeof rawPath !== "string") {
    return null;
  }

  const path = rawPath.trim();
  return path || null;
}

const app = express();
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    targetRoot: TARGET_ROOT,
    takeoutRoot: TAKEOUT_ROOT,
    targetExists: existsSync(TARGET_ROOT),
    takeoutExists: existsSync(TAKEOUT_ROOT),
  });
});

app.get("/api/files", async (_req, res) => {
  try {
    const result = await scanTargetFiles({
      targetRoot: TARGET_ROOT,
      takeoutRoot: TAKEOUT_ROOT,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/apply", async (req, res) => {
  const paths = req.body?.paths;
  const photoTakenEpochs = req.body?.photoTakenEpochs;

  if (!Array.isArray(paths) || paths.length === 0) {
    res.status(400).json({ error: "paths must be a non-empty array" });
    return;
  }

  if (
    photoTakenEpochs != null &&
    (typeof photoTakenEpochs !== "object" || Array.isArray(photoTakenEpochs))
  ) {
    res.status(400).json({ error: "photoTakenEpochs must be an object" });
    return;
  }

  try {
    const result = await applyPhotoTakenTimes({
      paths,
      photoTakenEpochs: photoTakenEpochs ?? {},
      targetRoot: TARGET_ROOT,
      takeoutRoot: TAKEOUT_ROOT,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/media", (req, res) => {
  const relPath = normalizeMediaPath(
    Array.isArray(req.query.path) ? req.query.path[0] : req.query.path,
  );

  if (!relPath) {
    res.status(400).json({ error: "path query parameter is required" });
    return;
  }

  const fullPath = resolveTargetFile(relPath);
  if (!fullPath) {
    res.status(403).json({ error: "Invalid path" });
    return;
  }

  if (!existsSync(fullPath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  res.sendFile(fullPath, (err) => {
    if (!err) {
      return;
    }

    if (!res.headersSent) {
      const status = err.code === "ENOENT" ? 404 : 500;
      res.status(status).json({
        error: status === 404 ? "File not found" : "Failed to read file",
      });
    }
  });
});

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

const clientDist = join(ROOT, "client/dist");
const serveClient =
  process.env.SERVE_CLIENT !== "false" && existsSync(clientDist);

if (serveClient) {
  app.use(express.static(clientDist));
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(join(clientDist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`Target: ${TARGET_ROOT}`);
  console.log(`Takeout: ${TAKEOUT_ROOT}`);
});
