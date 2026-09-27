import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#f2601a' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#f2601a' } },
  },
  images: ['public/favicon.svg'],
})
