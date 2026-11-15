/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where feature hooks read data from. Only "local" (browser storage) exists today. */
  readonly VITE_DATA_SOURCE?: "local";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
