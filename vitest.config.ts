import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['spec/javascript/**/*_spec.ts', 'spec/javascript/**/*.spec.ts', 'spec/javascript/**/*.test.ts'],
  },
});
