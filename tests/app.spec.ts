import { test, expect } from '@playwright/test';

// הגדרת כתובת האתר - בבדיקות מקומיות זה יהיה localhost, ב-GitHub זה יהיה כתובת ה-Preview
const URL = process.env.BASE_URL || 'http://localhost:3000'; 

test('has title and login button', async ({ page }) => {
  await page.goto(URL);

  // בדיקה שיש כותרת מתאימה (תשנה לפי מה שכתוב אצלך)
  await expect(page).toHaveTitle(/מערכת ניהול משימות ונוכחות/);

  // בדיקה שכפתור ההתחברות עם גוגל נמצא
  const loginButton = page.getByText('לאזור האישי');
  await expect(loginButton).toBeVisible();
});

test('navigation to personnel tab', async ({ page }) => {
  // כאן אפשר להוסיף טסט שמדמה כניסה למערכת ומעבר בין טאבים
  await page.goto(URL);
  // הערה: בגלל שיש אימות (Auth), נצטרך בהמשך להגדיר "מצב מחובר" לטסטים
});