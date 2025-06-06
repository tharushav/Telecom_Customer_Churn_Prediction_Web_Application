import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom', 
    globals: true,
    setupFiles: './src/test/extended-setup.js',
    coverage: {
      provider: 'v8', 
      reporter: ['text', 'json', 'html'],
    },
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  }
})
