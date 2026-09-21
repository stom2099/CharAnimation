import { expect, test } from '@playwright/test';

/**
 * Visual capture run.
 *
 * Not an assertion suite — it drives the app through its screens and writes
 * screenshots for a human (or an agent) to look at. Enabled with VISUAL=1 so
 * it never slows down CI.
 */
const OUT = process.env.VISUAL_OUT ?? 'screenshots';

test.skip(!process.env.VISUAL, 'set VISUAL=1 to capture screenshots');
test.use({ viewport: { width: 1280, height: 860 } });

test('capture the whole flow', async ({ page }) => {
  // Screenshots get shared widely, so capture the English UI regardless of the
  // browser's language. The store reads this key on first render.
  await page.addInitScript(() => {
    try {
      localStorage.setItem('charanim:locale', 'en');
    } catch {
      /* private mode */
    }
  });
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

  await page.goto('/');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/01-upload.png` });

  // An opaque image stops on the cut-out screen, which is what we want to show.
  await page.getByTestId('file-input').setInputFiles('tests/fixtures/opaque.jpg');
  await page.getByTestId('skip-removal').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/02-cutout.png` });
  await page.getByTestId('continue-to-animate').click();

  await page.getByRole('button', { name: 'New project' }).click();
  await page.getByTestId('sample-cat').click();
  await page.getByTestId('open-export').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/03-animate.png` });

  // Step through the loop so the deformation extremes are visible.
  await page.getByTestId('play-toggle').click();
  for (const [i, frac] of [0, 0.25, 0.5, 0.75].entries()) {
    await page.evaluate((f) => {
      const slider = document.querySelector('input[type=range]') as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(slider, String(f * Number(slider.max)));
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    }, frac);
    await page.waitForTimeout(220);
    await page.screenshot({
      path: `${OUT}/03-phase-${i}.png`,
      clip: { x: 16, y: 70, width: 900, height: 700 },
    });
  }

  await page.getByRole('button', { name: 'Fine tuning' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/04-tuning.png` });

  await page.getByTestId('open-export').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/05-export.png` });
  await page.keyboard.press('Escape');

  // Mobile layout.
  await page.setViewportSize({ width: 390, height: 780 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/06-mobile.png` });

  expect(problems, problems.join('\n')).toEqual([]);
});
