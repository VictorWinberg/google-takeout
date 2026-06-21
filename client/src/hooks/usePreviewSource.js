import { useEffect, useState } from "react";
import { mediaUrl } from "../utils/media.js";

export function usePreviewSource(previewPath) {
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
