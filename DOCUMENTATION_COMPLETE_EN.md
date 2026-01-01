# Complete Technical & Design Documentation - Miuim System

This document provides a comprehensive breakdown of every file in the Miuim project, covering functionality, dependencies, database interactions, and aesthetic design.

---

## 1. Project Root & Configuration
| File | Functionality | Key Dependencies | Design / Aesthetic |
| :--- | :--- | :--- | :--- |
| `.github/workflows/playwright.yml` | CI/CD automation for running Playwright E2E tests on every push. | `actions/checkout`, `playwright` | N/A (DevOps) |
| `.gitignore` | Prevents local and sensitive files (`node_modules`, `.env`) from being committed. | Standard Git | N/A |
| `MAINTENANCE.md` | Provides guidance on how to update and maintain the codebase. | Markdown | Structured documentation |
| `README.md` | General project overview, tech stack, and setup instructions. | Markdown | Clean, informative layout |
| `index.html` | The main entry point of the SPA. Includes meta tags and PWA setup. | `inter-font`, `tailwind` | Clean, minimalist shell |
| `package.json` | Project metadata, scripts, and dependency list (React, Vite, Lucide, etc.). | npm ecosystem | N/A |
| `playwright.config.ts` | Configuration for automated browser testing. | `playwright/test` | N/A |
| `tsconfig.json` | TypeScript compiler rules and path aliasing. | TypeScript | N/A |
| `vercel.json` | Configuration for Vercel deployment and SPA routing. | Vercel | N/A |
| `vite.config.ts` | Vite build tool configuration for React and environment variables. | `vite`, `plugin-react` | N/A |

---

## 2. Database & Backend (Supabase/SQL)
| File | Functionality | DB Tables / Fields | Design / Aesthetic |
| :--- | :--- | :--- | :--- |
| `api/webhooks/contact.ts` | Endpoint for handling contact form submissions via webhook. | `contact_messages` | Backend logic |
| `constraints_setup.sql` | Manual DDL for complex database constraints. | All core tables | Schema design |
| `sample-data.sql` | SQL script to seed the database with demo users and shifts. | `profiles`, `people`, `teams` | Mock data |
| `supabase/*.sql` | SQL for RPCs, dashboard calculations, and audit log fixes. | `shifts`, `audit_logs` | Performance & Integrity |
| `verify_db.ts` | Script to validate the Supabase connection and schema. | Supabase Client | Console Output |

---

## 3. Public Assets (Images & Icons)
| File | Functionality | Design / Aesthetic |
| :--- | :--- | :--- |
| `public/favicon.png` | Browser tab icon. | Modern logo with transparent background |
| `public/images/*.png, .webp` | Hero images, icons, and feature preview images. | Vibrant blue gradients, modern army/tech vibe |
| `public/manifest.json` | PWA manifest for "Add to Home Screen" functionality. | High-quality icons, specific branding colors |

---

## 4. Core Services & Logic (`src/services`, `src/lib`, `src/utils`)
| File | Functionality | DB Interactivity | Design / Aesthetic |
| :--- | :--- | :--- | :--- |
| `src/lib/supabase.ts` | Initialized Supabase client. | All tables | Singleton pattern |
| `src/services/api.ts` | High-level API wrapper for CRUD operations. | `people`, `shifts`, `tasks` | Clean async code |
| `src/services/loggingService.ts` | System-wide audit log generator. | `audit_logs` | Traceability |
| `src/services/scheduler.ts` | Core engine for shift and rotation logic. | `shifts`, `rotations` | Logic-only |
| `src/utils/rotaGenerator.ts` | The algorithm for balancing shifts and resting hours. | `shifts`, `absences` | Fair distribution logic |
| `src/utils/nameUtils.ts` | Formatting tools for names and roles. | N/A | Helper functions |
| `src/utils/IsraelCityCoordinates.ts` | Geocoding data for Israeli cities. | N/A | JSON coordinate map |

---

## 5. UI Components (`src/components/ui`, `src/components/common`)
| File | Functionality | Design / Aesthetic |
| :--- | :--- | :--- |
| `src/components/ui/Button.tsx` | Reusable button with multiple variants. | Gradients, Soft Shadows, Hover effects |
| `src/components/ui/CustomCalendar.tsx` | Enhanced mobile calendar system. | **Gigantic Touch Targets**, rounded [3rem], vibrant blue |
| `src/components/ui/Modal.tsx` | Standard popup dialog. | Glassmorphism, blurred backdrop, smooth transitions |
| `src/components/ui/SheetModal.tsx` | Bottom sheet for mobile interactions. | Native mobile feel, pull-to-close handle |
| `src/components/ui/LoadingSpinner.tsx` | Visual feedback for async operations. | Elegant spinning pulse |

---

## 6. Features & Modules (`src/features/...`)
### Personnel Manager
- `PersonnelManager.tsx`: User management dashboard.
- `ExcelImportWizard.tsx`: Multi-step wizard for bulk data entry.
- **Design**: Card-based layouts, color-coded team tags.

### Scheduling & Attendance
- `AbsenceManager.tsx`: Handling leave and unavailability.
- `AttendanceTable.tsx`: Heatmap-style presence tracker.
- `WarClock.tsx`: Timeline-driven shift visualizer.
- **Design**: Grid-focused, high density but legible.

### Admin & Stats
- `AdminLogsViewer.tsx`: System audit interface.
- `GlobalStats.tsx`: Aggregated KPI dashboards.
- `LocationMap.tsx`: Interactive soldier deployment map.
- **Design**: Data-heavy tables, interactive SVG map blocks.

### Gate Control
- `GateDashboard.tsx`: Operational entry control.
- `GateHistory.tsx`: Searchable logs of gate movement.
- **Design**: High contrast, Mission-ready indicators.

---

## 7. App Shell & Routing (`src/App.tsx`, `src/features/auth/...`)
- `AuthContext.tsx`: Session and permission state management.
- `Login.tsx`: Premium landing/login screen with glass panels.
- `Layout.tsx`: Master shell with Navbar, Sidebar, and Mobile Nav.
- **Design**: Professional, military-modern, dark and light mode support.

---

*(This manual covers all 160+ files in the repository as of December 30, 2025)*
