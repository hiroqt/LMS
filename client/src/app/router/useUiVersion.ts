import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useLocation, useNavigate } from "react-router";
import { readStoredUiVersion, resolveUiVersion, storeUiVersion, UI_VERSION_EVENT, type UiVersion } from "../../shared/lib/uiVersion";

function subscribe(onChange: () => void) {
  window.addEventListener(UI_VERSION_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(UI_VERSION_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Current UI version (classic or new) and a setter that remembers the choice.
 * The setter also removes ?ui= through the router, so the URL cannot
 * override the person's new choice on the next render.
 */
export function useUiVersion(): [UiVersion, (next: UiVersion) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const stored = useSyncExternalStore(subscribe, readStoredUiVersion, () => null);
  const { version, fromUrl } = resolveUiVersion(location.search, stored);

  useEffect(() => {
    if (fromUrl && stored !== version) storeUiVersion(version);
  }, [fromUrl, stored, version]);

  const setVersion = useCallback(
    (next: UiVersion) => {
      const params = new URLSearchParams(location.search);
      params.delete("ui");
      const search = params.toString();
      storeUiVersion(next);
      navigate({ pathname: location.pathname, search: search ? `?${search}` : "", hash: location.hash }, { replace: true });
    },
    [location.hash, location.pathname, location.search, navigate],
  );

  return [version, setVersion];
}
