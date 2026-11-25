import { useEffect, useState } from "react";

/** A `blob:` URL for the bytes, released when they change or the component goes away. */
export function useObjectUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    // Made and released here, not in render: StrictMode mounts twice, and a URL made during
    // render would be released by the first unmount while the second still shows it.
    const next = blob ? URL.createObjectURL(blob) : undefined;
    // oxlint-disable-next-line react/set-state-in-effect -- an object URL is an outside resource with a lifetime
    setUrl(next);
    return () => {
      if (next) URL.revokeObjectURL(next);
    };
  }, [blob]);
  return url;
}
