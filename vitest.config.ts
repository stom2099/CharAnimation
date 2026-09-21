import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**', 'src/export/spritesheet.ts', 'src/image/alpha.ts'],
      reporter: ['text', 'html'],
    },
  },
});
