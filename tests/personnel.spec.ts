import { test, expect } from '@playwright/test';

test.describe('ניהול כוח אדם', () => {
  
  test.beforeEach(async ({ page }) => {
    // ניווט ישיר לדף ניהול כוח אדם (או לדף הבית)
    await page.goto('/');
  });

  test('הוספת חייל חדש למערכת', async ({ page }) => {
    // 1. לחיצה על כפתור "ניהול כוח אדם" (תעדכן את השם לפי ה-UI שלך)
    const personnelTab = page.getByRole('link', { name: 'כוח אדם' });
    await personnelTab.click();

    // 2. לחיצה על הוספת חייל
    await page.getByRole('button', { name: 'הוסף חייל' }).click();

    // 3. מילוי פרטי החייל
    await page.getByLabel('שם מלא').fill('ישראל ישראלי');
    await page.getByLabel('טלפון').fill('0501234567');
    
    // במידה ויש בחירת צוות (Dropdown)
    await page.getByLabel('צוות').selectOption({ label: 'צוות א' });

    // 4. שמירה
    await page.getByRole('button', { name: 'שמירה' }).click();

    // 5. אימות - האם החייל מופיע ברשימה?
    const newPerson = page.getByText('ישראל ישראלי');
    await expect(newPerson).toBeVisible();
  });
});