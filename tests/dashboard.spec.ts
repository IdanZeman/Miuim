import { test, expect } from '@playwright/test';

test.describe('לוח שיבוצים', () => {
  test('בדיקת טעינת נתונים בלוח השיבוצים', async ({ page }) => {
    // ניווט לדף הבית
    await page.goto('/');

    // אם אנחנו עדיין בדף הנחיתה, ננסה ללחוץ על "לאזור האישי" כדי לעבור למערכת
    const loginButton = page.getByRole('button', { name: 'לאזור האישי' });
    if (await loginButton.isVisible()) {
      await loginButton.click();
    }

    // המתנה לטעינת האלמנט המרכזי בדאשבורד
    // שימוש ב-Locator מדויק יותר אם הטקסט מופיע בתוך כותרת
    const dashboardTitle = page.getByText('מבט יומי');
    
    // הוספת זמן המתנה ארוך יותר במקרה של טעינת נתונים מה-DB
    await expect(dashboardTitle).toBeVisible({ timeout: 10000 });

    // בדיקה שכפתור "שיבוץ אוטומטי" מופיע
    const autoScheduleBtn = page.getByRole('button', { name: 'שיבוץ אוטומטי' });
    await expect(autoScheduleBtn).toBeVisible();
  });
});