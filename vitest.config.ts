import { loadEnvConfig } from "@next/env"
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

loadEnvConfig(process.cwd());

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    alias: {
      '@app': resolve(__dirname, './app'),
    },
  },
})
