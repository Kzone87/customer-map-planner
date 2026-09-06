import { defineConfig } from 'vite';

export default defineConfig({
  base: '/customer-map-planner/',
  build: {
    rollupOptions: {
      input: ['index.html', 'mapping.html', 'compare.html', 'batch.html']
    }
  }
});
