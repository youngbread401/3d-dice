import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react-native': 'react-native-web',
    },
    extensions: ['.web.js', '.js', '.jsx', '.json'] // Add this line
  },
  build: {
    rollupOptions: {
      input: 'index.html',
    },
  },
});