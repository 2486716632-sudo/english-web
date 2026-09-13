import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules'],
    globals: false,
    environment: 'node',
  },
})
