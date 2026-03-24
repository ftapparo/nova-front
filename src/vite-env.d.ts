/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMeta {
  readonly env: ImportMetaEnv & { readonly VITE_GIT_HASH?: string };
}
