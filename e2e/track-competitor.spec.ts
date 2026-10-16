import { expect, test } from '@playwright/test';

const COMPETITOR_ID = 'north-analytics';

test.beforeEach(async ({ request }) => {
  // Start from a known state regardless of what earlier runs left behind.
  const response = await request.delete(`/api/competitors/${COMPETITOR_ID}`);
  expect([204, 404]).toContain(response.status());
});

test('track a competitor, open its timeline, then remove it', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Competitor id').fill(COMPETITOR_ID);
  await page.getByRole('button', { name: 'Track' }).click();

  const competitorLink = page.getByRole('link', { name: COMPETITOR_ID });
  await expect(competitorLink).toBeVisible();

  await competitorLink.click();
  await expect(page).toHaveURL(`/competitors/${COMPETITOR_ID}`);
  await expect(page.getByRole('heading', { name: COMPETITOR_ID })).toBeVisible();

  // The first snapshot is taken right after tracking and is never a "change".
  const timeline = page.getByRole('list', { name: /Snapshots of north-analytics/ });
  await expect(timeline.getByText('North Analytics').first()).toBeVisible();
  await expect(timeline.getByText('No change since previous snapshot.').last()).toBeVisible();

  await page.getByRole('link', { name: '← Back to competitors' }).click();
  await expect(page).toHaveURL('/');

  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: `Remove ${COMPETITOR_ID}` }).click();
  await expect(competitorLink).toBeHidden();
});
