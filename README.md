# google-takeout

Web app for working with a Google Photos takeout export: scan photos in custom folders, match them to takeout metadata sidecars, inspect timezone and photo-taken times, and fix file dates.

## Prerequisites

- **Node.js** 18+
- **exiftool** — used to read EXIF dates and timezone offsets from photo/video files
- **SetFile** — macOS only, used to set Date Created and Date Modified (included with Xcode Command Line Tools)

```bash
npm install
```

## Folder layout

Your media and takeout export live under `data/`. Only the folder structure is tracked in git (via `.gitkeep` files); photo and metadata contents are ignored.

```
google-takeout/
├── client/                  # React UI (Vite)
├── server/                  # Express API
├── lib/                     # Shared scan/apply logic
├── data/
│   ├── target/              # Your photos/videos, nested subfolders OK
│   │   └── 2026/
│   │       └── photo.jpg
│   └── takeout/             # Google Takeout export, nested subfolders OK
│       └── Google Photos/
│           └── Photos from 2026/
│               ├── photo.jpg
│               └── photo.jpg.supplemental-metadata.json
└── ...
```

Metadata sidecars are matched by filename or JSON `title` field. Supported sidecar names include `*.supplemental-metadata.json`, `*.suppl.json`, `att.*.json`, and truncated names like `*.mov..json`.

## Development

Start the API server and Vite dev server together:

```bash
npm run dev
```

Open http://localhost:5173 (client proxies API requests to the server on port 3001).

## Production

```bash
npm run build
npm start
```

Serves the built client and API on http://localhost:3001.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Server port |
| `TARGET_ROOT` | `data/target` | Root folder for your media files |
| `TAKEOUT_ROOT` | `data/takeout` | Root folder for the Google Takeout export |

## How timezones are resolved

Each source is evaluated independently and shown on its own line in the UI.

| Source | How it works |
|---|---|
| **Coordinates** | `geoData` / `geoDataExif` lat/lng in metadata (non-zero), looked up via [geo-tz](https://www.npmjs.com/package/geo-tz) |
| **Filename** | Datetime embedded in title (e.g. `20260111_134032.jpg`) compared to metadata `photoTakenTime` to infer UTC offset |
| **Exif** | `OffsetTimeOriginal` (or similar) read from the media file via exiftool |
| **Exif datetime** | `DateTimeOriginal` from EXIF compared to metadata `photoTakenTime` to infer UTC offset (when no explicit EXIF offset tag exists) |

**Photo taken (metadata)** converts the metadata UTC timestamp using coordinates only; without GPS data it stays in UTC.

**Photo taken (exif)** reads `SubSecDateTimeOriginal` or `DateTimeOriginal` directly from the file.

**Apply dates** prefers metadata `photoTakenTime` when it exists, otherwise falls back to EXIF. The highlighted column in the UI shows which source is used. macOS `SetFile` writes both Date Created and Date Modified in local time.
