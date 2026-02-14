// import { test, expect } from '@playwright/test';

// test.use({
//   storageState: 'playwright/.auth/user.json'
// });

// test('test', async ({ page }) => {
//   await page.goto('http://localhost:3000/dashboard');
//   await page.getByRole('button', { name: 'כוח אדם' }).click();

//   // --- לוגיקת ניקוי: בדיקה אם החייל קיים ומחיקתו ---
//   const soldierRow = page.locator('div').filter({ hasText: /^ישראל ישראלי ב$/ }).first();
  
//   if (await soldierRow.isVisible()) {
//     console.log('Soldier already exists, cleaning up...');
//     await soldierRow.click();
//     // לחיצה על כפתור המחיקה (לפי הלוגיקה שבסוף הטסט שלך)
//     await page.locator('.p-2.-ml-2').click();
//     await page.locator('div:nth-child(3) > .divide-y > div > .shrink-0.p-2 > .w-5').first().click();
    
//     // טיפול בדיאלוג האישור
//     page.once('dialog', dialog => dialog.accept()); 
//     await page.getByRole('button', { name: 'מחק (1)' }).click();
    
//     // המתנה שהמחיקה תסתיים והשורה תיעלם
//     await expect(soldierRow).toBeHidden();
//   }

//   // --- המשך הטסט המקורי: הוספת החייל מחדש ---
//   await page.locator('.fixed.bottom-24').click();
//   await page.getByRole('textbox', { name: 'ישראל ישראלי' }).click();
//   await page.getByRole('textbox', { name: 'ישראל ישראלי' }).fill('ישראל ישראלי ב');
  
//   // ... שאר הקוד שלך ...
//   await page.locator('div').filter({ hasText: /^טלפון$/ }).first().click();
//   await page.getByRole('textbox', { name: '-0000000' }).fill('0578974561');
//   await page.getByRole('textbox', { name: 'email@example.com' }).fill('sadas@sada.com');
//   await page.getByRole('button', { name: 'בחר צוות' }).click();
//   await page.getByRole('button', { name: 'קרמר' }).click();
//   await page.getByRole('button', { name: 'קלע' }).click();
//   await page.getByRole('button', { name: 'חובש' }).click();
//   await page.getByRole('combobox', { name: 'הוסף שדה חדש' }).click();
//   await page.getByRole('combobox', { name: 'הוסף שדה חדש' }).fill('מידת נעליים');
//   await page.locator('.bg-white.border.border-slate-200.text-slate-600').click();
//   await page.getByRole('textbox').nth(4).fill('43');
//   await page.getByRole('button', { name: 'שמור' }).click();

//   // וידוא שהחייל נוסף בהצלחה
//   await expect(page.locator('div').filter({ hasText: /^ישראל ישראלי ב$/ })).toBeVisible();
// });