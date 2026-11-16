/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where feature hooks read data from. Only "local" (browser storage) exists today. */
  readonly VITE_DATA_SOURCE?: "local";
  /** LMS API origin for server-backed features (`/isms-link`). Defaults to http://localhost:5200. */
  readonly VITE_LMS_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
