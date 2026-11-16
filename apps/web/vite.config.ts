import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    // In development the API runs on its own port; the browser still calls a relative /api.
    proxy: { "/api": "http://localhost:3000" },
  },
});
