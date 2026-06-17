# google-takeout

Tools for working with a Google Photos takeout export: finding metadata sidecars, resolving timezones, matching photos in custom folders to takeout metadata, and fixing file dates.

## Prerequisites

- **Node.js** 18+
- **exiftool** — used to read EXIF dates and timezone offsets from photo/video files
- **SetFile** — macOS only, used to set Date Created and Date Modified during match (included with Xcode Command Line Tools)

```bash
npm install
```

## Folder layout

Place your export and custom albums like this:

```
google-takeout/
├── My Folders/          # Your photos/videos, nested subfolders OK
│   └── 2026/
│       └── photo.jpg
└── Takeout/             # Google Takeout export, nested subfolders OK
    └── Google Photos/
        └── Photos from 2026/
            ├── photo.jpg
            └── photo.jpg.supplemental-metadata.json
```

Metadata sidecars are matched by filename or JSON `title` field. Supported sidecar names include `*.supplemental-metadata.json`, `*.suppl.json`, `att.*.json`, and truncated names like `*.mov..json`.

## npm scripts

| Script | Description |
|---|---|
| `npm run find-metadata` | List all metadata JSON files under the current directory |
| `npm run geo-count` | Count metadata files with/without GPS coordinates |
| `npm run timezone-count` | Count how many files resolve a timezone from each source |
| `npm run match-metadata` | Match `My Folders` media to `Takeout` metadata, show times, set file dates |
| `npm run timezone` | Run `get-timezone.js` (pass args after `--`) |

---

## find-metadata.js

Find and analyze Google Photos metadata sidecars, or match media in `My Folders` against metadata anywhere under `Takeout`.

### List metadata files

```bash
node find-metadata.js
node find-metadata.js --root Takeout
```

Prints one relative path per line.

### Count metadata files

```bash
node find-metadata.js --count
node find-metadata.js --root Takeout --count
```

### Count GPS data

```bash
node find-metadata.js --geo-count
node find-metadata.js --root Takeout --geo-count
```

Example output:

```
Total metadata files: 158
With location (geoData lat/lng ≠ 0): 114
Zero location (geoData lat/lng = 0): 44
```

### Count timezone sources

```bash
node find-metadata.js --timezone-count
node find-metadata.js --root Takeout --timezone-count --my-folders "My Folders"
```

Pass `--my-folders` so EXIF-based timezone counts can look up the corresponding media file.

Example output:

```
Total metadata files: 158
Timezone (coordinates): 114
Timezone (filename): 33
Timezone (exif): 2
Timezone (exif datetime): 5
```

### Match My Folders to Takeout metadata

The main workflow. For each photo or video under `My Folders`, finds a matching metadata JSON anywhere under `Takeout`, prints timezone and photo time info, then sets the file's **Date Created** and **Date Modified** to the photo taken time.

```bash
node find-metadata.js --match --my-folders "My Folders" --takeout Takeout

# or
npm run match-metadata
```

Example output:

```
2026/2B54909C-FAE7-4F37-BDB6-EAA9EC7AA5BB.jpg
Timezone (coordinates): not found
Timezone (filename): not found
Timezone (exif): UTC+1
Timezone (exif datetime): not found
Photo taken (metadata): 3 Jan 2026, 13:48:58 UTC+1
Photo taken (exif): 3 Jan 2026, 13:48:58 UTC+1

Victor/2504FE96-3753-4B05-A1B9-91B282D692A9.jpg
Timezone (coordinates): Europe/Berlin
Timezone (filename): not found
Timezone (exif): UTC+1
Timezone (exif datetime): not found
Photo taken (metadata): 2 Jan 2026, 15:18:55 CET
Photo taken (exif): 2 Jan 2026, 15:18:55 UTC+1
```

**File dates** are set using EXIF photo time when available, otherwise the metadata `photoTakenTime` timestamp. macOS `SetFile` writes both Date Created and Date Modified in local time.

---

## get-timezone.js

Inspect timezone and photo taken time for a single metadata file, media file, or coordinate pair.

### From a metadata JSON file

```bash
node get-timezone.js --json "Takeout/Google Photos/Photos from 2026/IMG_6443.JPG.supplemental-metadata.json"

# If the media file lives in My Folders (not next to the JSON), pass the search root:
node get-timezone.js --json "Takeout/.../photo.jpg.supplemental-metadata.json" --my-folders "My Folders"
```

### From a media file (EXIF only)

```bash
node get-timezone.js --file "My Folders/2026/photo.jpg"
```

### From coordinates

```bash
node get-timezone.js --lat 55.5986556 --lng 13.00185
```

---

## How timezones are resolved

Each source is evaluated independently and shown on its own line.

| Source | How it works |
|---|---|
| **Coordinates** | `geoData` / `geoDataExif` lat/lng in metadata (non-zero), looked up via [geo-tz](https://www.npmjs.com/package/geo-tz) |
| **Filename** | Datetime embedded in title (e.g. `20260111_134032.jpg`) compared to metadata `photoTakenTime` to infer UTC offset |
| **Exif** | `OffsetTimeOriginal` (or similar) read from the media file via exiftool |
| **Exif datetime** | `DateTimeOriginal` from EXIF compared to metadata `photoTakenTime` to infer UTC offset (when no explicit EXIF offset tag exists) |

**Photo taken (metadata)** converts the metadata UTC timestamp using the first available timezone above (coordinates → filename → exif → exif datetime).

**Photo taken (exif)** reads `SubSecDateTimeOriginal` or `DateTimeOriginal` directly from the file.

**File date setting** (match mode) uses EXIF photo time first, then falls back to the metadata `photoTakenTime` timestamp.
