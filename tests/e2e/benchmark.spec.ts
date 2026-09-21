import { test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

/**
 * Measures preview frame rate and export timings on the machine running it.
 * Enabled with BENCH=1; the numbers go into docs/BENCHMARK.md.
 */
test.skip(!process.env.BENCH, 'set BENCH=1 to run the benchmark');
test.setTimeout(600_000);
test.use({ viewport: { width: 1280, height: 860 } });

test('measure preview and export', async ({ page }) => {
  const rows: string[] = [];

  await page.goto('/');
  await page.getByTestId('sample-cat').click();
  await page.getByTestId('open-export').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1500);

  // Give the adaptive controller a moment to settle before measuring.
  await page.waitForTimeout(2500);
  const renderer = await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid=preview-canvas]') as HTMLCanvasElement;
    return {
      kind: canvas.getContext('webgl2') ? 'webgl2' : 'canvas2d',
      buffer: `${canvas.width}x${canvas.height}`,
    };
  });
  rows.push(`renderer=${renderer.kind} buffer=${renderer.buffer}`);

  // Frame rate over three seconds of steady playback.
  const fps = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let frames = 0;
        const start = performance.now();
        const tick = () => {
          frames++;
          if (performance.now() - start < 3000) requestAnimationFrame(tick);
          else resolve(Math.round((frames / (performance.now() - start)) * 1000));
        };
        requestAnimationFrame(tick);
      }),
  );
  rows.push(`preview_fps=${fps}`);

  for (const format of ['gif', 'apng', 'spritesheet'] as const) {
    for (const size of ['256', '512'] as const) {
      await page.getByTestId('open-export').click();
      await page.getByTestId(`format-${format}`).click();
      await page.getByRole('radio', { name: '24', exact: true }).click();
      await page.getByRole('radio', { name: size, exact: true }).click();

      const started = Date.now();
      const download = page.waitForEvent('download', { timeout: 300_000 });
      await page.getByTestId('start-export').click();
      const file = await download;
      const elapsed = Date.now() - started;
      const path = await file.path();
      const bytes = path ? (await import('node:fs/promises')).stat(path) : null;
      const size_b = bytes ? (await bytes).size : 0;
      rows.push(`export ${format} ${size}px 24fps: ${elapsed} ms, ${Math.round(size_b / 1024)} KB`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  }

  await writeFile(process.env.BENCH_OUT ?? 'benchmark.txt', rows.join('\n') + '\n');
  console.log(rows.join('\n'));
});
