import { test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** Writes real export files to disk so they can be inspected outside the browser. */
const OUT = process.env.ARTIFACT_OUT ?? 'artifacts';

test.skip(!process.env.ARTIFACTS, 'set ARTIFACTS=1 to write export files');
test.setTimeout(240_000);

test('export one file per format', async ({ page }) => {
  await mkdir(OUT, { recursive: true });
  await page.goto('/');
  await page.getByTestId('sample-cat').click();
  await page.getByTestId('open-export').waitFor({ timeout: 30_000 });

  for (const format of ['gif', 'apng', 'spritesheet'] as const) {
    await page.getByTestId('open-export').click();
    await page.getByTestId(`format-${format}`).click();
    await page.getByRole('radio', { name: '15', exact: true }).click();
    await page.getByRole('radio', { name: '256', exact: true }).click();

    const downloads: Promise<void>[] = [];
    const handler = (d: import('@playwright/test').Download) => {
      downloads.push(
        (async () => {
          const src = await d.path();
          if (src) await writeFile(path.join(OUT, d.suggestedFilename()), await readFile(src));
        })(),
      );
    };
    page.on('download', handler);
    await page.getByTestId('start-export').click();
    await page.waitForTimeout(12_000);
    page.off('download', handler);
    await Promise.all(downloads);
    await page.keyboard.press('Escape');
  }
});
