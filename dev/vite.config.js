import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    alias: {
      'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js': resolve(__dirname, './tests/mocks/firebase-app.js'),
      'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js': resolve(__dirname, './tests/mocks/firebase-auth.js'),
      'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js': resolve(__dirname, './tests/mocks/firebase-firestore.js')
    }
  }
});
