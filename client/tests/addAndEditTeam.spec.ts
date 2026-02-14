// import { test, expect } from '@playwright/test';

// test.use({
//   storageState: 'playwright/.auth/user.json'
// });

// test('teams lifecycle test stable', async ({ page }) => {
//   // 1. ניווט והמתנה שהרשת תהיה שקטה (קריטי בגלל ריבוי קריאות ל-Supabase) 
//   await page.goto('http://localhost:3000/dashboard');
//   // וודא שהאלמנטים הבסיסיים של הדאשבורד נטענו
//   await expect(page.getByRole('heading', { name: 'בית' })).toBeVisible({ timeout: 10000 });
//   await page.getByRole('button', { name: 'כוח אדם' }).click();  
//   await page.getByRole('button', { name: 'צוותים' }).click();

//   const teamName = 'חפק מגד';
//   // לוקטור גמיש שמתאים לטקסט רציף
//   const teamRow = page.locator('div').filter({ hasText: new RegExp(`^${teamName}`) }).first();

//   // --- לוגיקת ניקוי בטוחה ---
//   while (await teamRow.count() > 0) {
//     const firstRow = teamRow.first();
    
//     // 2. פתרון יציב: לחיצה על הכפתור האחרון בכרטיס (בדרך כלל הפח במבנה שלך)
//     // או חיפוש כפתור לפי ה-Role שלו בתוך הכרטיס
//     await firstRow.getByRole('button').last().click({ force: true });
    
//     // 3. אישור המודאל (כפי שמופיע ב-Snapshot)
//     await page.getByRole('button', { name: 'אישור' }).click();

//     // 4. המתנה להיעלמות
//     await expect(firstRow).toBeHidden({ timeout: 10000 });

//     // וידוא היעלמות השורה
//     try {
//         await expect(teamRow).toBeHidden({ timeout: 15000 });
//     } catch (e) {
//       console.log("UI stuck, forcing page reload...");
//       await page.reload({ waitUntil: 'networkidle' });
//       await page.getByRole('button', { name: 'כוח אדם' }).click();
//       await page.getByRole('button', { name: 'צוותים' }).click();
//     }
//   }

//   // --- יצירת הצוות ---
//   await page.locator('.fixed.bottom-24').click();
//   await page.getByRole('textbox').nth(1).click();
//   await page.getByRole('textbox').nth(1).fill('חפק מגד');
//   await page.locator('.rounded-full.border').first().click(); 
//   await page.getByRole('button', { name: 'שמור' }).click();
// });