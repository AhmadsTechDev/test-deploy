import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    // Saat development (npm run dev), request /api diteruskan ke backend lokal.
    // Ini sebenarnya juga "reverse proxy", versi mininya Vite.
    // Di Docker, tugas ini diambil alih oleh nginx.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
