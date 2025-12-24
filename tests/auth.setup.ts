import { test as setup } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// --- הגדרות נתיבים עבור ES Modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// טעינת משתני סביבה - בודק קודם .env.local ואז .env
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const authFile = 'playwright/.auth/user.json';

setup('authenticate and handle onboarding', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!email || !password) {
    throw new Error('Missing TEST_USER_EMAIL or TEST_USER_PASSWORD in environment variables');
  }

  // 1. כניסה לדף הבית וביצוע Login
  await page.goto('/');
  
  // הזרקת לוגין דרך האובייקט של Supabase שחשפנו ב-window
  await page.evaluate(async ({ email, password }) => {
    // @ts-ignore
    const { data, error } = await window.supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  }, { email, password });

  // המתנה לטעינה ראשונית אחרי הלוגין
  await page.waitForLoadState('networkidle');

  // 2. בדיקה האם אנחנו במסך Onboarding (הקמת ארגון)
  // כאן אנחנו בודקים לפי ה-URL או לפי אלמנט ייחודי במסך
  if (page.url().includes('onboarding') || await page.getByText(/הקמת ארגון|שם הארגון/i).isVisible()) {
    console.log('Starting Onboarding flow...');
    
    // מילוי שם ארגון
    const orgInput = page.getByPlaceholder(/שם הארגון/i).or(page.getByLabel(/שם הארגון/i));
    await orgInput.fill(`פלוגת בדיקות ${Date.now()}`); // שם ייחודי למניעת כפילויות
    
    // לחיצה על כפתור המשך/צור
    await page.getByRole('button', { name: 'יצירת ארגון והמשך' }).click();

    // 3. מסך בחירת שיטת עבודה (אקסל או ידני)
    // אנחנו מחפשים את הכפתור של "הגדרה ידנית" כדי להגיע לדאשבורד
    const manualBtn = page.getByRole('button', { name: /הגדרה ידנית/i });
    await manualBtn.waitFor({ state: 'visible', timeout: 10000 });
    await manualBtn.click();
  }

  // 4. אימות הגעה לדאשבורד
  // אנחנו מחכים לראות אלמנט שקיים רק בתוך המערכת (כמו "מבט יומי")
  await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => {
    console.log('Current URL is:', page.url());
  });
  
  const dashboardElement = page.getByText(/מבט יומי/i);
  await dashboardElement.waitFor({ state: 'visible', timeout: 10000 });

  // 5. שמירת המצב (Cookies & LocalStorage)
  await page.context().storageState({ path: authFile });
  console.log('Auth state saved successfully!');
});