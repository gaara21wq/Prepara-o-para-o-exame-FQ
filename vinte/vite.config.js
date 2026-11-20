import { defineConfig } from 'vite';

// base relativa: funciona em qualquer pasta (Netlify, Live Server, etc.)
export default defineConfig({
  base: './',
  server: { open: true }
});
