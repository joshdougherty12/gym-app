interface ImportMetaEnv {
  /** Partner sync server, e.g. https://righttrack-sync.<account>.workers.dev. Unset hides the partner link. */
  readonly VITE_SYNC_URL?: string
  /** Where the web app lives, for link QR codes. Defaults to the GitHub Pages address. */
  readonly VITE_WEB_URL?: string
}
