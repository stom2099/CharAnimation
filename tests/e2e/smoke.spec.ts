import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

/**
 * End-to-end coverage of the path a visitor actually takes.
 *
 * The sample images already carry an alpha channel, so the app skips the
 * background-removal model. That keeps the suite hermetic: no network, no
 * 40 MB download, and the exercised code path is otherwise identical.
 */

async function openSample(page: Page, sample = 'cat') {
  await page.goto('/');
  await page.getByTestId(`sample-${sample}`).click();
  await expect(page.getByTestId('open-export')).toBeVisible({ timeout: 30_000 });
}

test('loads without console errors and shows the upload step', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'CharAnimation' })).toBeVisible();
  await expect(page.getByTestId('file-input')).toBeAttached();
  expect(errors).toEqual([]);
});

test('a sample with transparency goes straight to the animation step', async ({ page }) => {
  await openSample(page);
  await expect(page.getByTestId('preset-sway')).toBeVisible();
  await expect(page.getByTestId('play-toggle')).toBeVisible();
});

test('the preview renders visible pixels and they change over time', async ({ page }) => {
  await openSample(page);

  const sample = async () =>
    page.evaluate(() => {
      const canvas = document.querySelector('canvas.touch-none') as HTMLCanvasElement | null;
      if (!canvas) return null;
      const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
      const w = canvas.width;
      const h = canvas.height;
      const buf = new Uint8Array(w * h * 4);
      if (gl) {
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      } else {
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        buf.set(ctx.getImageData(0, 0, w, h).data);
      }
      let opaque = 0;
      let checksum = 0;
      for (let i = 0; i < buf.length; i += 4) {
        if (buf[i + 3] > 24) {
          opaque++;
          checksum = (checksum + buf[i] * 3 + buf[i + 1] * 5 + buf[i + 2] * 7 + i) % 2147483647;
        }
      }
      return { opaque, checksum };
    });

  const first = await sample();
  expect(first, 'preview canvas should exist').not.toBeNull();
  expect(first!.opaque, 'the sprite should be drawn').toBeGreaterThan(500);

  await page.waitForTimeout(700);
  const second = await sample();
  expect(second!.checksum, 'the sprite should be animating').not.toBe(first!.checksum);
});

test('switching preset changes the motion', async ({ page }) => {
  await openSample(page, 'plant');
  await page.getByTestId('preset-wind').click();
  await expect(page.getByTestId('preset-wind')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('preset-pendulum').click();
  await expect(page.getByTestId('preset-pendulum')).toHaveAttribute('aria-pressed', 'true');
});

test('exports a playable GIF', async ({ page }) => {
  await openSample(page);
  await page.getByTestId('open-export').click();
  await page.getByTestId('format-gif').click();
  await page.getByRole('radio', { name: '12', exact: true }).click();
  await page.getByRole('radio', { name: '256', exact: true }).click();

  const download = page.waitForEvent('download', { timeout: 120_000 });
  await page.getByTestId('start-export').click();
  const file = await download;

  expect(file.suggestedFilename()).toMatch(/^cat_sway_\d+x\d+_12fps\.gif$/);
  const path = await file.path();
  const bytes = await readFile(path!);
  expect(bytes.length).toBeGreaterThan(2000);
  expect(bytes.subarray(0, 6).toString('ascii')).toBe('GIF89a');
  // NETSCAPE2.0 marks the infinite-loop extension block.
  expect(bytes.includes(Buffer.from('NETSCAPE2.0', 'ascii'))).toBe(true);
});

test('exports a sprite sheet whose JSON matches the frame count', async ({ page }) => {
  await openSample(page, 'balloon');
  await page.getByTestId('open-export').click();
  await page.getByTestId('format-spritesheet').click();
  await page.getByRole('radio', { name: '12', exact: true }).click();
  await page.getByRole('radio', { name: '256', exact: true }).click();
  // Take the two loose files rather than the zip so the JSON can be inspected.
  await page.getByRole('switch', { name: /zip/i }).click();

  const downloads: { name: string; path: string }[] = [];
  page.on('download', async (d) => {
    downloads.push({ name: d.suggestedFilename(), path: (await d.path()) ?? '' });
  });

  await page.getByTestId('start-export').click();
  await expect.poll(() => downloads.length, { timeout: 120_000 }).toBe(2);

  const json = downloads.find((d) => d.name.endsWith('.sheet.json'));
  expect(json).toBeDefined();
  const meta = JSON.parse(await readFile(json!.path, 'utf8')) as {
    frames: Record<string, unknown>;
    animations: Record<string, string[]>;
    meta: { frameRate: number };
  };

  // 3.6 s balloon loop at 12 fps snaps to 43 frames.
  const frames = Object.keys(meta.frames).length;
  expect(frames).toBeGreaterThan(10);
  expect(meta.animations.idle).toHaveLength(frames);
  expect(meta.meta.frameRate).toBe(12);

  const png = downloads.find((d) => d.name.endsWith('.sheet.png'));
  const bytes = await readFile(png!.path);
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
});

test('exports an APNG with an animation control chunk', async ({ page }) => {
  await openSample(page);
  await page.getByTestId('open-export').click();
  await page.getByTestId('format-apng').click();
  await page.getByRole('radio', { name: '12', exact: true }).click();
  await page.getByRole('radio', { name: '256', exact: true }).click();

  const download = page.waitForEvent('download', { timeout: 120_000 });
  await page.getByTestId('start-export').click();
  const file = await download;
  const bytes = await readFile((await file.path())!);

  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
  expect(bytes.includes(Buffer.from('acTL', 'ascii')), 'APNG animation chunk').toBe(true);
  expect(bytes.includes(Buffer.from('fcTL', 'ascii')), 'APNG frame chunk').toBe(true);
});

test('reopening a saved project keeps its framing', async ({ page }) => {
  await openSample(page);

  // The reported output size encodes the cutout margin, so it is a good proxy
  // for "the project came back exactly as it was".
  const readSize = async () => {
    await page.getByTestId('open-export').click();
    const summary = await page.locator('p.font-mono').innerText();
    await page.keyboard.press('Escape');
    return summary.match(/(\d+)×(\d+)/)?.[0];
  };
  const before = await readSize();
  expect(before).toBeTruthy();

  await page.waitForTimeout(1300); // let the debounced autosave land
  await page.reload();

  await page.getByRole('button', { name: /Gần đây|Recent/ }).click();
  await page.getByRole('button', { name: /^(Mở|Open)$/ }).first().click();
  await expect(page.getByTestId('open-export')).toBeVisible({ timeout: 20_000 });

  expect(await readSize()).toBe(before);
});

test('an opaque image stops on the cut-out step until the user continues', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles('tests/fixtures/opaque.jpg');

  // No alpha, so the app must not skip ahead on its own.
  await expect(page.getByTestId('run-removal')).toBeVisible();
  await expect(page.getByTestId('open-export')).toHaveCount(0);

  // Skipping keeps the user here, where the margin is still adjustable.
  await page.getByTestId('skip-removal').click();
  await expect(page.getByTestId('continue-to-animate')).toBeVisible();
  await expect(page.getByTestId('open-export')).toHaveCount(0);

  await page.getByTestId('continue-to-animate').click();
  await expect(page.getByTestId('open-export')).toBeVisible();
  await expect(page.getByTestId('preset-sway')).toBeVisible();
});

test('reports a clear error when the model cannot be downloaded', async ({ page }) => {
  // Deterministic offline behaviour: block the weights rather than depending on
  // whatever the network happens to be doing. The 40 MB download is also far
  // too slow to sit in a smoke suite.
  await page.route(/staticimgly\.com|huggingface\.co|cdn-lfs/i, (route) => route.abort());

  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles('tests/fixtures/opaque.jpg');
  await page.getByTestId('run-removal').click();

  // A failure must surface, and must not strand the user on a dead screen.
  await expect(page.getByText(/Tách nền thất bại|Background removal failed/)).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByTestId('run-removal')).toBeEnabled();

  await page.getByTestId('skip-removal').click();
  await page.getByTestId('continue-to-animate').click();
  await expect(page.getByTestId('open-export')).toBeVisible();
});

test('the Canvas2D fallback renderer still draws and exports', async ({ page }) => {
  // ?renderer=canvas2d is the documented escape hatch for broken GPU drivers,
  // and the only practical way to cover the fallback path.
  await page.goto('/?renderer=canvas2d');
  await page.getByTestId('sample-cat').click();
  await expect(page.getByTestId('open-export')).toBeVisible({ timeout: 30_000 });

  const usesFallback = await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid=preview-canvas]') as HTMLCanvasElement;
    return !canvas.getContext('webgl2');
  });
  expect(usesFallback, 'the override should have selected Canvas2D').toBe(true);

  // A resize clears the canvas for one frame, so poll rather than sampling once.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const canvas = document.querySelector('[data-testid=preview-canvas]') as HTMLCanvasElement;
          const ctx = canvas.getContext('2d');
          if (!ctx) return 0;
          const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
          let opaque = 0;
          for (let i = 3; i < data.length; i += 4) if (data[i] > 24) opaque++;
          return opaque;
        }),
      { message: 'the fallback should draw the sprite', timeout: 15_000 },
    )
    .toBeGreaterThan(500);

  await page.getByTestId('open-export').click();
  await page.getByRole('radio', { name: '12', exact: true }).click();
  await page.getByRole('radio', { name: '256', exact: true }).click();
  const download = page.waitForEvent('download', { timeout: 120_000 });
  await page.getByTestId('start-export').click();
  expect((await download).suggestedFilename()).toMatch(/\.gif$/);
});
