import { test, expect } from '@playwright/test';

test.use({
  storageState: 'playwright/.auth/user.json'
});

test('teams lifecycle test stable', async ({ page }) => {
  // 1. ניווט והמתנה שהרשת תהיה שקטה (קריטי בגלל ריבוי קריאות ל-Supabase) 
  await page.goto('http://localhost:3000/dashboard');
  // וודא שהאלמנטים הבסיסיים של הדאשבורד נטענו
  await expect(page.getByRole('heading', { name: 'בית' })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'כוח אדם' }).click();  
  await page.getByRole('button', { name: 'צוותים' }).click();

  const teamName = 'חפק מגד';
  // לוקטור גמיש שמתאים לטקסט רציף
  const teamRow = page.locator('div').filter({ hasText: new RegExp(`^${teamName}`) }).first();

  // --- לוגיקת ניקוי בטוחה ---
  if (await teamRow.count() > 0) {
    console.log(`Cleaning up existing team: ${teamName}`);
    await teamRow.click({ force: true });
    await page.locator('.p-2.-ml-2').click();
    // שימוש בנתיב המחיקה הקצר והעקבי שציינת שעובד
    await page.locator('div:nth-child(2) > .shrink-0.p-2 > .w-5').click();
    
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'מחק (1)' }).click();
    try {
        await expect(teamRow).toBeHidden({ timeout: 15000 });
    } catch (e) {
      console.log("UI stuck, forcing page reload...");
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'כוח אדם' }).click();
    }
  }

  // --- יצירת הצוות ---  await page.locator('.fixed.bottom-24').click();
  await page.locator('.fixed.bottom-24').click();
  await page.getByRole('textbox').nth(1).click();
  await page.getByRole('textbox').nth(1).fill('חפק מגד');
  await page.locator('.w-8.h-8.rounded-full.bg-indigo-500').click();
  await page.getByRole('button', { name: 'שמור' }).click();
  await page.locator('div:nth-child(4) > .shrink-0.p-2').click();
  await page.locator('.w-5.h-5.rounded-full.border.flex.items-center.justify-center.transition-all.bg-blue-500').click();
  await page.getByRole('heading', { name: 'חפק מגד' }).click();
  await page.locator('.w-8.h-8.rounded-full.bg-blue-500').click();
  await page.getByRole('button', { name: 'שמור' }).click();
  await page.locator('div:nth-child(4) > .shrink-0.p-2 > .w-5').click();
  await page.getByRole('button', { name: 'מחק (1)' }).click();
  await page.getByRole('button', { name: 'אישור' }).click();
});