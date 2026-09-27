import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

// Runs the Worker and its Durable Object locally in workerd (Miniflare). No Cloudflare account involved.
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: { bindings: { ALLOWED_ORIGINS: 'https://joshdougherty12.github.io,https://localhost,capacitor://localhost' } },
    }),
  ],
})
