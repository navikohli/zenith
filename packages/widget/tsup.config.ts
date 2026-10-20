import { defineConfig } from 'tsup'
import { readFileSync } from 'node:fs'

const notice = `/*!\n${readFileSync(new URL('./THIRD_PARTY_NOTICES.md', import.meta.url), 'utf8')}\n*/`

export default defineConfig([
  // Library build — ESM + CJS + declarations.
  // React subpath only builds when consumers import it.
  {
    entry: {
      index: 'src/index.ts',
      'react/index': 'src/react/index.ts',
      version: 'src/version.ts',
    },
    format: ['esm', 'cjs'],
    banner: { js: notice },
    // Declarations come from `tsc --emitDeclarationOnly` (TypeScript 7).
    // tsup's dts worker still imports the old compiler API (`ts.sys`).
    dts: false,
    sourcemap: true,
    target: 'es2020',
    clean: true,
    external: ['react'],
  },
  // Browser IIFE — served verbatim by /api/widget/sdk.js
  {
    entry: { browser: 'src/browser-queue.ts' },
    format: ['iife'],
    globalName: 'ZenithBundle',
    banner: { js: notice },
    minify: true,
    sourcemap: false,
    target: 'es2020',
    outExtension: () => ({ js: '.js' }),
  },
])
