import { expect, test } from '@playwright/test';
import { waitForHydration } from './helpers';
import { GOLDEN_PATH_USER, PASSWORD } from './test-users';

// Golden path (docs/adr/0012-test-strategy.md decision 4): check-in
// (NORMAL) -> generate -> log sets, including one skipped exercise
// (ADR 0009) -> finalize session.
test('check-in resolves to NORMAL, generates a workout, logs and skips sets, then finalizes', async ({ page }) => {
  await page.goto('/login');
  await waitForHydration(page);
  await page.getByLabel('Email').fill(GOLDEN_PATH_USER.email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // LoginForm always routes through /onboarding on sign-in; the test user
  // is pre-seeded with a profile (e2e/global-setup.ts), so this spec goes
  // straight to the home page rather than re-onboarding.
  await page.waitForURL('**/onboarding');
  await page.goto('/app');
  await waitForHydration(page);

  await page.waitForURL('**/checkin');
  await waitForHydration(page);
  await page.getByRole('button', { name: 'high' }).click();
  await page.getByRole('button', { name: 'No pain today' }).click();
  await page.getByRole('button', { name: '30 min' }).click();
  await page.getByRole('button', { name: 'basic' }).click();

  await expect(page.getByText('a normal session')).toBeVisible();
  await page.getByRole('button', { name: "Generate today's workout" }).click();

  await page.waitForURL('**/workout/*');
  await waitForHydration(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // Log the first set.
  const rpeGroup = page.getByRole('group', { name: /RPE/ });
  await rpeGroup.getByRole('button', { name: '7', exact: true }).click();
  await page.getByRole('button', { name: 'Log set' }).click();
  await expect(page.getByText(/Resting for/)).toBeVisible();

  // Skip whatever exercise is current now (ADR-0009's incomplete-session path).
  await page.getByRole('button', { name: 'Skip exercise' }).click();

  // Finalize without necessarily completing every remaining set/exercise.
  await page.getByRole('button', { name: 'End session' }).click();
  await expect(page.getByText('Workout session finished. Nice work.')).toBeVisible();

  await page.goto('/app');
  await waitForHydration(page);
  await expect(page.getByText("Today's workout is complete.")).toBeVisible();
});
