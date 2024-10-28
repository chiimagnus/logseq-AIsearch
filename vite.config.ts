import reactPlugin from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import logseqDevPlugin from "vite-plugin-logseq";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [logseqDevPlugin(), reactPlugin()],
  // Makes HMR available for development
  build: {
    target: "esnext",
    minify: "esbuild",
  },
  server: {
    proxy: {
      '/api/generate': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      }
    }
  }
});
