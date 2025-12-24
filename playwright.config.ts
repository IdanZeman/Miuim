import { defineConfig, devices } from '@playwright/test';

// הגדרת נתיב לקובץ האימות
export const STORAGE_STATE = 'playwright/.auth/user.json';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:3000', // וודא שזה הפורט הנכון (לפעמים 5173 ב-Vite)
    trace: 'on-first-retry',
  },

  projects: [
    // --- שלב 1: הגדרת פרויקט ה-Setup להתחברות ---
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    // --- שלב 2: הגדרת הדפדפנים שישתמשו באימות ---
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // כאן אנחנו אומרים לדפדפן לטעון את ה-Session השמור
        storageState: STORAGE_STATE,
      },
      // הפרויקט הזה ירוץ רק אחרי שה-setup הצליח
      dependencies: ['setup'],
    },

    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['setup'],
    },

    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['setup'],
    },
  ],

  /* הרצת השרת המקומי באופן אוטומטי בזמן הטסטים */
  webServer: {
    command: 'npm run dev', // או 'npm run start'
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});