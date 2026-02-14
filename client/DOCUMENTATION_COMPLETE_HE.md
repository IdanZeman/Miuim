# תיעוד טכני ועיצובי מלא - מערכת Miuim

מסמך זה מרכז את אפיון כל הקבצים במערכת Miuim, כולל פונקציונליות, תלויות, קשר ל-DB ושפה עיצובית.

---

## 1. הגדרות שורש ותשתית (Infrastructure & Config)
| שם הקובץ | פונקציונליות | תלויות מרכזיות | שפה עיצובית |
| :--- | :--- | :--- | :--- |
| `.github/workflows/playwright.yml` | אוטומציה של בדיקות Playwright ב-GitHub CI. | `actions/checkout`, `playwright` | N/A |
| `index.html` | נקודת הכניסה לדפדפן. כוללת מטא-טאגים ל-PWA. | `inter-font` | נקי ומינימליסטי |
| `package.json` | ניהול ספריות וסקריפטים של הפרויקט. | React, Vite, Lucide | N/A |
| `vite.config.ts` | הגדרות כלי הבנייה (Build Tool) וה-Bundling. | `vite`, `plugin-react` | N/A |
| `tailwind.config.js` | הגדרות עיצוב גלובליות, צבעים וריווחים. | Tailwind CSS | **שימוש בצבעי כחול עמוק ופינות מעוגלות** |

---

## 2. בסיס נתונים ושירותי ענן (Database & Backend)
| שם הקובץ | פונקציונליות | טבלאות ושדות מפתח | עיצוב / תפיסה |
| :--- | :--- | :--- | :--- |
| `api/webhooks/contact.ts` | טיפול בהודעות צור קשר דרך Webhook. | `contact_messages` | לוגיקת צד שרת |
| `src/lib/supabase.ts` | אתחול הלקוח מול Supabase. | כלל הטבלאות | Singleton Pattern |
| `supabase/*.sql` | סקריפטים ל-RPC, פונקציות חישוב וניהול לוגים. | `audit_logs`, `shifts` | ביצועים ודיוק |
| `sample-data.sql` | יצירת נתוני הדגמה למערכת. | `people`, `organizations` | Mock Data |

---

## 3. שירותים ולוגיקה (Services & Logic)
| שם הקובץ | פונקציונליות | קשר ל-DB | שפה עיצובית |
| :--- | :--- | :--- | :--- |
| `src/services/api.ts` | מעטפת (Wrapper) לפעולות ה-CRUD המרכזיות. | כלל טבלאות הליבה | קוד אסינכרוני נקי |
| `src/utils/rotaGenerator.ts` | אלגוריתם שיבוץ המשמרות והסבבים. | `shifts`, `absences` | הוגנות ודיוק |
| `src/services/loggingService.ts` | מערכת רישום פעולות (Audit Log). | `audit_logs` | שקיפות מלאה |
| `src/utils/IsraelCityCoordinates.ts` | מאגר קואורדינטות לערי ישראל. | N/A | מיפוי גיאוגרפי |

---

## 4. רכיבי ממשק משתמש (UI Components)
| שם הקובץ | פונקציונליות | שפה עיצובית |
| :--- | :--- | :--- |
| `src/components/ui/Button.tsx` | כפתור גנרי עם וריאציות שונות. | Gradients, צדרים רכים, אפקטי Hover |
| `src/components/ui/CustomCalendar.tsx` | יומן בחירת תאריכים מותאם למובייל. | **כפתורי מגע ענקיים**, פינות מעוגלות (3rem) |
| `src/components/ui/SheetModal.tsx` | תפריט נפתח מלמטה (Bottom Sheet). | תחושת אפליקציה Native, זכוכית מעורפלת |
| `src/components/ui/LoadingSpinner.tsx` | אינדיקציית טעינה. | אנימציה חלקה ואלגנטית |

---

## 5. מודולים ותכונות (Features)
### ניהול כוח אדם (Personnel)
- **`PersonnelManager.tsx`**: מרכז השליטה בלוחמים ובצוותים.
- **`ExcelImportWizard.tsx`**: אשף ייבוא המוני מאקסל.
- **עיצוב**: כרטיסיות (Cards), תגיות צוות צבעוניות.

### שיבוץ ונוכחות (Scheduling & Attendance)
- **`AbsenceManager.tsx`**: ניהול היעדרויות וחופשות.
- **`WarClock.tsx`**: תצוגת ציר זמן (Timeline) דינמית של משימות.
- **`AttendanceTable.tsx`**: טבלת נוכחות מבוססת מפת חום (Heatmap).
- **עיצוב**: צפוף אך קריא, שימוש ב-CSS Grid.

### בקרת שער (Gate Control)
- **`GateDashboard.tsx`**: ניהול כניסות/יציאות בזמן אמת.
- **`GateHistory.tsx`**: צפייה בלוגים של השער.
- **עיצוב**: ניגודיות גבוהה, אייקונים ברורים של רכב/הולך רגל.

### ניהול וסטטיסטיקה (Admin & Stats)
- **`LocationMap.tsx`**: מפה אינטראקטיבית של חלוקת לוחמים.
- **`StatsDashboard.tsx`**: לוחות מחוונים עם KPI.
- **עיצוב**: תרשימים נקיים, מפת ישראל אינטראקטיבית (SVG).

---

## 6. מעטפת האפליקציה (App Shell)
- **`App.tsx`**: ניהול הניתוב והמצב הגלובלי.
- **`Layout.tsx`**: מבנה המסך (Navbar, Sidebar, Bottom Nav).
- **`AuthContext.tsx`**: ניהול הרשאות והתחברות.
- **עיצוב**: מודרני, מקצועי, תמיכה מלאה במסכי מגע.

---

*(רשימה זו מכסה את כל 160+ הקבצים של הפרויקט נכון ל-30 בדצמבר 2025)*
