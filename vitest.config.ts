import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: { lines: 80, functions: 80, branches: 80 },
      include: ['scripts/prices/**', 'lib/db.ts', 'lib/price-store.ts', 'lib/report-store.ts', 'lib/report-aggregator.ts', 'lib/agents/tools.ts', 'lib/agents/graph.ts'],
    },
  },
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
  },
})
