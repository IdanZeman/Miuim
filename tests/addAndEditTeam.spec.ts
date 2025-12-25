import { test, expect } from '@playwright/test';

test.use({
  storageState: 'playwright/.auth/user.json'
});

test('test', async ({ page }) => {
  await page.getByRole('button', { name: 'צוותים' }).click();
  await page.locator('.fixed.bottom-24').click();
  await page.getByRole('textbox').nth(1).click();
  await page.getByRole('textbox').nth(1).fill('חפק מגד');
  await page.locator('.w-8.h-8.rounded-full.bg-green-500').click();
  await page.locator('div').filter({ hasText: 'שם הצוותצבע' }).nth(2).click();
  await page.locator('.p-2.-ml-2').click();
  await page.getByRole('heading', { name: 'זיו' }).click();
  await page.locator('.w-8.h-8.rounded-full.bg-pink-500').click();
  await page.getByRole('button', { name: 'שמור' }).click();
  await page.getByRole('button').filter({ hasText: /^$/ }).nth(2).click();
  await page.locator('div').filter({ hasText: /^חפק מגד$/ }).click();
  await page.locator('.p-2.-ml-2').click();
  await page.locator('div:nth-child(3) > .divide-y > div > .shrink-0.p-2 > .w-5').first().click();
  page.once('dialog', dialog => {
    console.log(`Dialog message: ${dialog.message()}`);
    dialog.dismiss().catch(() => {});
  });
  await page.getByRole('button', { name: 'מחק (1)' }).click();
});