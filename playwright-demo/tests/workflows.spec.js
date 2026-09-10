import { test, expect } from '@playwright/test';

async function login(page) {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill('steven@example.test');
  await page.getByLabel('Password', { exact: true }).fill('DemoPass123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Request dashboard' })).toBeVisible();
}
async function newRequest(page, name = 'Bracket study') {
  await login(page);
  await page.getByRole('link', { name: 'New request' }).click();
  await page.getByLabel('Project name', { exact: true }).fill(name);
  await page.getByLabel('Material', { exact: true }).selectOption('Aluminum');
}
test.beforeEach(async ({ page }) => {
  // Every test has its own browser context and storage. Surface unexpected JS errors.
  page.on('pageerror', error => { throw error; });
});

test('TC01 | empty login is rejected with actionable feedback', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Email and password are required.');
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
});

test('TC02 | invalid credentials do not enter the dashboard', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill('steven@example.test');
  await page.getByLabel('Password', { exact: true }).fill('WrongPassword');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.');
  await expect(page).toHaveURL(/#login$/);
});

test('TC03 | valid login and navigation preserve an empty queue', async ({ page }) => {
  await login(page);
  await expect(page.getByText('No requests yet.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'New request' }).click();
  await expect(page).toHaveURL(/#new$/);
  await expect(page.getByRole('heading', { name: 'New simulation request' })).toBeVisible();
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await expect(page).toHaveURL(/#dashboard$/);
  await expect(page.getByText('No requests yet.', { exact: true })).toBeVisible();
});

test('TC04 | sign out clears the session and guards direct navigation', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/#login$/);
  await page.goto('/#new');
  await expect(page).toHaveURL(/#login$/);
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByLabel('Project name', { exact: true })).toHaveCount(0);
});

test('TC05 | required request fields reject whitespace and missing values', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'New request' }).click();
  await page.getByLabel('Project name', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Submit request' }).click();
  await expect(page.getByRole('alert')).toHaveText('Project name must be 3-60 characters. Select a material. Load must be a whole number from 1 to 10000 N.');
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await expect(page.getByText('No requests yet.', { exact: true })).toBeVisible();
});

test('TC06 | invalid load boundaries never create a request', async ({ page }) => {
  await newRequest(page);
  for (const value of ['0', '-1', '10001', '1.5']) {
    await test.step(`Reject load ${value} N`, async () => {
      await page.getByLabel('Load (N)', { exact: true }).fill(value);
      await page.getByRole('button', { name: 'Submit request' }).click();
      await expect(page.getByRole('alert')).toHaveText('Load must be a whole number from 1 to 10000 N.');
      await expect(page).toHaveURL(/#new$/);
    });
  }
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await expect(page.getByText('No requests yet.', { exact: true })).toBeVisible();
});

test('TC07 | minimum valid request is normalized and survives reload', async ({ page }) => {
  await newRequest(page, '  Bracket study  ');
  await page.getByLabel('Load (N)', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Submit request' }).click();
  await expect(page.getByRole('status')).toHaveText('Request submitted for review.');
  const rows = page.getByRole('table', { name: 'Submitted requests' }).locator('tbody tr');
  await expect(rows).toHaveCount(1);
  await expect(rows.first().getByRole('cell')).toHaveText(['Bracket study', 'Aluminum', '1 N', 'Queued']);
  await page.reload();
  await expect(rows).toHaveCount(1);
  await expect(rows.first().getByRole('cell')).toHaveText(['Bracket study', 'Aluminum', '1 N', 'Queued']);
});

test('TC08 | maximum valid load is accepted exactly once', async ({ page }) => {
  await newRequest(page, 'Maximum load study');
  await page.getByLabel('Material', { exact: true }).selectOption('Steel');
  await page.getByLabel('Load (N)', { exact: true }).fill('10000');
  await page.getByRole('button', { name: 'Submit request' }).click();
  await expect(page).toHaveURL(/#dashboard$/);
  const rows = page.getByRole('table', { name: 'Submitted requests' }).locator('tbody tr');
  await expect(rows).toHaveCount(1);
  await expect(rows.first().getByRole('cell')).toHaveText(['Maximum load study', 'Steel', '10000 N', 'Queued']);
});
