import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Chromium before 111 rejects `var(--x,)` (an empty fallback) when --x is a registered custom
// property, which Tailwind 4 uses for every ring, filter and transform — focus rings vanish there.
// `var(--x, )` means the same and works in every browser, so the built CSS gets the space back.
// Tailwind emits its CSS late, so this runs on the finished bundle. The file name hash is computed
// before this step; the rewrite is deterministic, so a given name still always maps to the same file.
// (If this plugin is ever changed, make sure the CSS changes too, or cached copies may be served.)
const emptyVarFallbackFix = () => ({
  name: 'empty-var-fallback-fix',
  apply: 'build',
  generateBundle(_options, bundle) {
    for (const file of Object.values(bundle)) {
      if (file.type === 'asset' && file.fileName.endsWith('.css')) {
        file.source = String(file.source).replace(/var\((--[\w-]+),\)/g, 'var($1, )')
      }
    }
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), emptyVarFallbackFix()],
})
