import { test, expect } from '@playwright/test';

test.use({
  storageState: 'playwright/.auth/user.json'
});

test('dashboard stability test', async ({ page }) => {
  // 1. ניווט עם המתנה לטעינה מלאה של הרשת
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' });

  // 2. וודא שאלמנט מרכזי בדף נטען לפני שמתחילים (למשל הכותרת "בית" או "מבט יומי")
  await expect(page.getByRole('heading', { name: 'בית' })).toBeVisible({ timeout: 10000 });

  // שימוש בלוקטורים יציבים
  await page.getByRole('button').filter({ hasText: /^$/ }).nth(2).click();
  await page.getByRole('textbox', { name: 'זמן מנוחה / שמירה' }).fill('השכמה');
  
  // אחרי לחיצה על שמור, נחכה שהפעולה תסתיים בשרת
  await page.getByRole('button', { name: 'שמור' }).click();
  await page.waitForLoadState('networkidle'); 

  // הוספת לו"ז נוסף
  await page.getByRole('button').filter({ hasText: /^$/ }).nth(2).click();
  await page.getByRole('button', { name: 'ש', exact: true }).nth(1).click();
  await page.getByRole('textbox').first().fill('09:00');
  await page.getByRole('textbox').nth(1).fill('10:00');
  await page.getByRole('textbox', { name: 'זמן מנוחה / שמירה' }).fill('לוז מפקדים');
  
  await page.getByRole('button', { name: 'תפקיד' }).click();
  await page.getByRole('button', { name: 'קלע' }).click();
  await page.getByRole('button', { name: 'צלף' }).click();
  
  await page.getByRole('button', { name: 'שמור' }).click();
  await page.waitForLoadState('networkidle');

  // פתיחת סינונים
  await page.getByRole('button').filter({ hasText: /^$/ }).nth(1).click();
  
  // לפעמים המודאל לוקח זמן להיפתח בגלל אנימציה
  await expect(page.getByText('סינון לוח זמנים')).toBeVisible({ timeout: 7000 });
  
  await page.getByRole('button', { name: 'צלף' }).click();
  await page.getByRole('button', { name: 'פיטוסי' }).click();
  await page.getByRole('button', { name: 'הצג הכל' }).click();

  // סגירת המודאל
  await page.getByRole('heading', { name: 'סינון לוח זמנים' })
    .locator('..')
    .getByRole('button').first()
    .click({ force: true });

  // הגדלת ה-timeout של ההמתנה לסגירה (למקרה של אנימציה איטית)
  await expect(page.getByText('סינון לוח זמנים')).toBeHidden({ timeout: 10000 });
  
  // לחיצה על כפתור היעד - וודא שהוא נראה לפני לחיצה
  const reportBtn = page.getByRole('button', { name: 'צפה בדוח המלא שלך' });
  await expect(reportBtn).toBeVisible({ timeout: 10000 });
  await reportBtn.click();
});