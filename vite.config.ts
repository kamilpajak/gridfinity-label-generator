import { defineConfig } from 'vite';
import { qwikVite } from '@builder.io/qwik/optimizer';
import { qwikCity } from '@builder.io/qwik-city/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [qwikCity(), qwikVite()],
  resolve: {
    alias: {
      '~': resolve(__dirname, './src')
    }
  }
});