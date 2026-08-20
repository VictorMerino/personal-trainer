import { expect, test } from '@playwright/test';
import { waitForHydration } from './helpers';
import { CHOICE_USER, PASSWORD } from './test-users';

// CHOICE branch (docs/adr/0012-test-strategy.md decision 4): check-in
// resolves to CHOICE -> user picks REST -> correct minimal plan appears,
// no /workouts/generate call fires (ADR-0011 decisions 2/4).
test('check-in resolves to CHOICE, resolving to REST shows no generate call', async ({ page }) => {
  const generateCalls: string[] = [];
  await page.route('**/api/workouts/generate', (route) => {
    generateCalls.push(route.request().url());
    return route.continue();
  });

  await page.goto('/login');
  await waitForHydration(page);
  await page.getByLabel('Email').fill(CHOICE_USER.email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.waitForURL('**/onboarding');
  await page.goto('/app');
  await waitForHydration(page);

  await page.waitForURL('**/checkin');
  await waitForHydration(page);
  await page.getByRole('button', { name: 'low' }).click();
  await page.getByRole('button', { name: 'No pain today' }).click();
  await page.getByRole('button', { name: '15 min' }).click();
  await page.getByRole('button', { name: 'basic' }).click();

  await page.waitForURL('**/checkin/**/choice');
  await waitForHydration(page);
  await expect(page.getByRole('heading', { name: 'Low energy, some time to spare' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Go for a walk' })).toBeVisible();

  await page.getByRole('button', { name: 'Rest today' }).click();
  await expect(page.getByText("Today's a rest day. Enjoy it.")).toBeVisible();

  expect(generateCalls).toHaveLength(0);

  await page.goto('/app');
  await waitForHydration(page);
  await expect(page.getByText("Today's a rest day.")).toBeVisible();
});
