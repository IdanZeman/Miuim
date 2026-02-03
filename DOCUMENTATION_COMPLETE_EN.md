# Complete Technical & Design Documentation - Miuim System

This document provides a comprehensive breakdown of every file in the Miuim project, covering functionality, dependencies, database interactions, and aesthetic design.

**Last Updated:** February 3, 2026

---

## 1. Project Root & Configuration
| File | Functionality | Key Dependencies | Design / Aesthetic |
| :--- | :--- | :--- | :--- |
| `.github/workflows/playwright.yml` | CI/CD automation for running Playwright E2E tests on every push. | `actions/checkout`, `playwright` | N/A (DevOps) |
| `.gitignore` | Prevents local and sensitive files (`node_modules`, `.env`) from being committed. | Standard Git | N/A |
| `DESIGN_STANDARDS.md` | Documents the UI/UX design standards and patterns. | Markdown | Design reference |
| `FREEMIUM_MIGRATION.md` | Migration guide for freemium tier implementation. | Markdown | Migration docs |
| `MAINTENANCE.md` | Provides guidance on how to update and maintain the codebase. | Markdown | Structured documentation |
| `MODAL_DESIGN_SPEC.md` | Specification for modal design patterns across the system. | Markdown | Design specs |
| `README.md` | General project overview, tech stack, and setup instructions. | Markdown | Clean, informative layout |
| `index.html` | The main entry point of the SPA. Includes meta tags and PWA setup. | `inter-font`, `tailwind` | Clean, minimalist shell |
| `package.json` | Project metadata, scripts, and dependency list (React, Vite, Lucide, etc.). | npm ecosystem | N/A |
| `playwright.config.ts` | Configuration for automated browser testing. | `playwright/test` | N/A |
| `tailwind.config.js` | Tailwind CSS configuration with custom IDF theme colors. | `tailwindcss` | Theme system |
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
| `create_snapshot_tables.sql` | SQL for creating snapshot system tables for historical data. | `attendance_snapshots`, `status_snapshots` | Data archiving |
| `delete_person_cascade.sql` | Cascading deletion logic for person records. | `people`, `shifts`, `absences` | Data cleanup |
| `deleted_people_archive.sql` | Archive system for deleted personnel records. | `deleted_people_archive` | Soft delete pattern |
| `enable_realtime.sql` | Enables Supabase real-time subscriptions on tables. | All core tables | Real-time sync |
| `nightly_snapshots.sql` | Scheduled snapshot creation for daily attendance. | Snapshot tables | Automation |
| `security_patch_rls_v2.sql` | Row-level security policies for data protection. | All tables | Security |
| `supabase/*.sql` | SQL for RPCs, dashboard calculations, and audit log fixes. | `shifts`, `audit_logs` | Performance & Integrity |
| `verify_db.ts` | Script to validate the Supabase connection and schema. | Supabase Client | Console Output |
| `telemetry_system.sql` | Analytics and telemetry tracking system. | `telemetry_events` | Usage analytics |

---

## 3. Public Assets (Images & Icons)
| File | Functionality | Design / Aesthetic |
| :--- | :--- | :--- |
| `public/favicon.png` | Browser tab icon. | Modern logo with transparent background |
| `public/images/*.png, .webp` | Hero images, icons, and feature preview images. | Vibrant blue gradients, modern army/tech vibe |
| `public/manifest.json` | PWA manifest for "Add to Home Screen" functionality. | High-quality icons, specific branding colors |
| `public/rules-icons/*.tsx` | Custom SVG icons for roles (Tank, Medic, etc.). | Military iconography |

---

## 4. Core Services & Logic (`src/services`, `src/lib`, `src/utils`)

### Services (`src/services/`)
| File | Functionality | DB Interactivity |
| :--- | :--- | :--- |
| `adminService.ts` | Super-admin operations (org management). | `organizations`, `profiles` |
| `analytics.ts` | Google Analytics integration and event tracking. | N/A |
| `api.ts` | High-level API wrapper for CRUD operations. | `people`, `shifts`, `tasks` |
| `attendanceReportService.ts` | Generates attendance reports and exports. | `attendance_records` |
| `auditService.ts` | Audit log creation and querying. | `audit_logs` |
| `battalionService.ts` | Battalion-level data aggregation. | `battalions`, `organizations` |
| `historyService.ts` | Historical shift and assignment data retrieval. | `shifts`, `audit_logs` |
| `rotaHistoryService.ts` | Rotation history tracking for soldiers. | `team_rotations` |
| `scheduler.ts` | Core engine for shift and rotation logic. | `shifts`, `rotations` |
| `snapshotService.ts` | Manages daily attendance snapshots. | `attendance_snapshots` |
| `supabaseClient.ts` | Supabase client singleton instance. | All tables |

### Utils (`src/utils/`)
| File | Functionality |
| :--- | :--- |
| `assignmentValidation.ts` | Validates shift assignments against constraints. |
| `attendanceExport.ts` | Excel export logic for attendance data. |
| `attendanceUtils.ts` | Attendance calculation helpers (present/absent). |
| `dateUtils.ts` | Date formatting and manipulation utilities. |
| `errorUtils.ts` | Standardized error handling. |
| `IsraelCityCoordinates.ts` | Geocoding data for Israeli cities. |
| `lazyWithRetry.ts` | Lazy loading with retry logic for code splitting. |
| `nameUtils.ts` | Formatting tools for names and roles. |
| `permissions.ts` | Permission checking utilities for RBAC. |
| `phoneUtils.ts` | Phone number formatting and validation. |
| `rotaGenerator.ts` | Algorithm for balanced shift generation. |
| `shiftUtils.ts` | Shift duration and overlap calculations. |

### Lib (`src/lib/`)
| File | Functionality |
| :--- | :--- |
| `logger.ts` | Centralized logging system with categories. |
| `supabase.ts` | Supabase client initialization. |
| `utils.ts` | General utility functions. |

### Hooks (`src/hooks/`)
| File | Functionality |
| :--- | :--- |
| `useActivityLogs.ts` | Fetches and manages activity log data. |
| `useBattalionData.ts` | Battalion-level data fetching hook. |
| `useBattalionSnapshots.ts` | Historical snapshot data for battalions. |
| `useClickOutside.ts` | Detects clicks outside a component. |
| `useConfirmation.tsx` | Confirmation dialog state management. |
| `useGateSystem.ts` | Gate control system state and operations. |
| `useMissionReports.ts` | Mission report data fetching. |
| `useOrganizationData.ts` | Primary data fetching hook for organization. |
| `usePageTracking.ts` | Page view analytics tracking. |
| `usePermissions.ts` | Permission checking hook with RBAC. |
| `useTacticalDelete.tsx` | Safe deletion with impact analysis. |

---

## 5. UI Components (`src/components/`)

### Core UI (`src/components/ui/`)
| File | Functionality | Design / Aesthetic |
| :--- | :--- | :--- |
| `ActionBar.tsx` | Floating action bar for bulk operations. | Glassmorphism, sticky positioning |
| `ActivityFeed.tsx` | Real-time activity stream display. | Timeline design, animated entries |
| `Button.tsx` | Reusable button with multiple variants. | Gradients, Soft Shadows, Hover effects |
| `CommandPalette.tsx` | Universal search and navigation (⌘K). | Spotlight-style, fuzzy search |
| `ConfirmationModal.tsx` | Standard confirmation dialog. | Danger/warning variants |
| `CustomCalendar.tsx` | Enhanced mobile calendar system. | **Gigantic Touch Targets**, rounded [3rem], vibrant blue |
| `DateNavigator.tsx` | Date range navigation component. | Compact, intuitive arrows |
| `DatePicker.tsx` | Date selection with calendar popup. | Modern calendar UI |
| `DropdownMenu.tsx` | Dropdown menu component. | Smooth animations |
| `EmptyStateGuide.tsx` | Onboarding guide for empty states. | Illustrated, friendly |
| `ExportButton.tsx` | Export functionality trigger. | Icon button variants |
| `FeatureTour.tsx` | Interactive feature walkthrough. | Spotlight with tooltips |
| `FloatingActionButton.tsx` | Mobile FAB for quick actions. | Material Design inspired |
| `GenericModal.tsx` | Flexible modal wrapper. | Glassmorphism, blurred backdrop |
| `HomeStatusSelector.tsx` | Home/Base status quick toggle. | Toggle switch design |
| `Input.tsx` | Styled input component. | Consistent border styling |
| `LoadingSpinner.tsx` | Visual feedback for async operations. | Elegant spinning pulse |
| `LocationPickerModal.tsx` | Map-based location selection. | Interactive map |
| `Modal.tsx` | Base modal component. | Glassmorphism, smooth transitions |
| `MultiSelect.tsx` | Multi-selection dropdown. | Chip-based selections |
| `PageInfo.tsx` | Page information header. | Clean typography |
| `PersonSearchSelect.tsx` | Person search with autocomplete. | Avatar previews |
| `Select.tsx` | Custom select dropdown. | Styled select menu |
| `SettingsSkeleton.tsx` | Loading skeleton for settings. | Animated placeholders |
| `SheetModal.tsx` | Bottom sheet for mobile interactions. | Native mobile feel, pull-to-close handle |
| `Skeleton.tsx` | Generic loading skeleton. | Shimmer effect |
| `Switch.tsx` | Toggle switch component. | iOS-style toggle |
| `TacticalDeleteWrapper.tsx` | Delete with impact preview. | Danger zone styling |
| `Toast.tsx` | Toast notification system. | Animated slide-in |
| `Tooltip.tsx` | Hover tooltip component. | Dark background, arrow pointer |

### Layout (`src/components/layout/`)
| File | Functionality | Design / Aesthetic |
| :--- | :--- | :--- |
| `Layout.tsx` | Master shell with navigation structure. | Responsive, RTL support |
| `Navbar.tsx` | Top navigation bar. | Sticky header, org switcher |
| `Sidebar.tsx` | Desktop sidebar navigation. | Collapsible, icon-based |

### Gate Control (`src/components/GateControl/`)
| File | Functionality | Design / Aesthetic |
| :--- | :--- | :--- |
| `GateDashboard.tsx` | Main gate operations dashboard. | High contrast, status indicators |
| `GateHistory.tsx` | Gate movement history display. | Searchable logs |
| `GateHistoryList.tsx` | List view of gate events. | Timeline format |
| `LogDetailsModal.tsx` | Detailed view of gate log entry. | Modal with metadata |
| `ManageAuthorizedVehiclesModal.tsx` | Vehicle authorization management. | CRUD interface |

### Common (`src/components/common/`)
| File | Functionality |
| :--- | :--- |
| `AutoSizer.tsx` | Auto-sizing container component. |
| `ErrorBoundary.tsx` | React error boundary with fallback. |
| `SystemMessagePopup.tsx` | System-wide message display. |

---

## 6. Features & Modules (`src/features/`)

### Authentication (`src/features/auth/`)
| File | Functionality | Design / Aesthetic |
| :--- | :--- | :--- |
| `AuthContext.tsx` | Session and permission state management. | Context provider |
| `ClaimProfile.tsx` | Profile claiming for new users. | Onboarding flow |
| `ClaimProfileModal.tsx` | Modal for claiming existing soldier profile. | Selection interface |
| `CreateOrganizationPage.tsx` | New organization creation. | Form wizard |
| `JoinPage.tsx` | Invitation link handling. | Welcome design |
| `Login.tsx` | Premium landing/login screen. | Glass panels, gradients |
| `Onboarding.tsx` | Multi-step onboarding wizard. | Step indicators, animations |
| `TermsModal.tsx` | Terms of service display. | Legal content display |

### Core Pages (`src/features/core/`)
| File | Functionality | Design / Aesthetic |
| :--- | :--- | :--- |
| `AccessibilityStatement.tsx` | Accessibility compliance statement. | Legal document format |
| `AnnouncementsWidget.tsx` | Organization announcements display. | Card-based, priority badges |
| `AttendanceReportingWidget.tsx` | Quick attendance check-in/out. | One-tap actions |
| `ContactPage.tsx` | Contact form and information. | Modern form design |
| `FAQPage.tsx` | Frequently asked questions. | Accordion style |
| `GlobalClickTracker.tsx` | Analytics click tracking. | Invisible utility |
| `HomePage.tsx` | Main dashboard home page. | Widget grid, stats cards |
| `LandingPage.tsx` | Public landing page (legacy). | Marketing design |
| `LeaveForecastWidget.tsx` | Upcoming leave predictions. | Calendar preview |

### Personnel Management (`src/features/personnel/`)
| File | Functionality | Design / Aesthetic |
| :--- | :--- | :--- |
| `CustomFieldsManager.tsx` | Custom field schema management. | Field builder UI |
| `ExcelImportWizard.tsx` | Multi-step wizard for bulk data entry. | Column mapping, validation |
| `PersonnelListSkeleton.tsx` | Loading skeleton for personnel list. | Animated placeholders |
| `PersonnelManager.tsx` | User management dashboard. | Card/table views, filters |
| `PersonnelTableView.tsx` | Table view of personnel data. | Sortable, filterable columns |

### Scheduling & Attendance (`src/features/scheduling/`)
| File | Functionality | Design / Aesthetic |
| :--- | :--- | :--- |
| `AbsenceManager.tsx` | Leave and unavailability management. | Calendar integration |
| `AssignmentModal.tsx` | Shift assignment interface. | Drag-drop, role filtering |
| `AttendanceManager.tsx` | Main attendance tracking view. | Grid/calendar layouts |
| `AttendanceRow.tsx` | Single row in attendance grid. | Status indicators |
| `AttendanceStatsModal.tsx` | Personal attendance statistics. | Charts, metrics |
| `AttendanceTable.tsx` | Heatmap-style presence tracker. | Color-coded cells |
| `AttendanceTableVirtualRow.tsx` | Virtualized row for performance. | Optimized rendering |
| `AutoScheduleModal.tsx` | AI-powered auto-scheduling. | Date range selection |
| `BulkAttendanceModal.tsx` | Bulk attendance update. | Multi-select interface |
| `ComplianceInsights.tsx` | Compliance warnings and insights. | Alert cards |
| `ConstraintsManager.tsx` | Scheduling constraints editor. | Rule builder UI |
| `DraftBanner.tsx` | Draft mode indicator. | Warning banner |
| `DraftControl.tsx` | Draft management controls. | Publish/discard buttons |
| `ExportScheduleModal.tsx` | Schedule export options. | Format selection |
| `GlobalTeamCalendar.tsx` | Team-wide calendar view. | Monthly overview |
| `IdlePersonnelInsights.tsx` | Underutilized personnel alerts. | Suggestion cards |
| `ImportAttendanceModal.tsx` | Excel attendance import. | File upload, mapping |
| `MissionReportModal.tsx` | Mission report creation. | Form with validation |
| `MobileScheduleList.tsx` | Mobile-optimized schedule view. | Swipeable cards |
| `PersonInfoModal.tsx` | Detailed person information. | Profile card style |
| `PersonalAttendanceCalendar.tsx` | Individual attendance calendar. | Monthly grid |
| `PersonalRotationEditor.tsx` | Personal rotation adjustments. | Inline editing |
| `RotaWizardModal.tsx` | AI rotation wizard with GPT. | Multi-step wizard |
| `RotationEditor.tsx` | Team rotation management. | Drag-drop calendar |
| `ScheduleBoard.tsx` | Main scheduling interface. | Timeline, Gantt-style |
| `ShiftDetailsModal.tsx` | Shift detail view. | Info cards |
| `StatusEditModal.tsx` | Status editing interface. | Form modal |
| `StatusEditPopover.tsx` | Quick status edit popover. | Compact form |
| `TeamAttendanceCalendar.tsx` | Team attendance overview. | Aggregated view |
| `UnassignedTaskBank.tsx` | Pool of unassigned tasks. | Draggable items |
| `WarClock.tsx` | Timeline-driven shift visualizer. | Clock-style display |
| `WeeklyPersonnelGrid.tsx` | Week view of personnel schedule. | Grid layout |

### Task Management (`src/features/tasks/`)
| File | Functionality | Design / Aesthetic |
| :--- | :--- | :--- |
| `SegmentEditor.tsx` | Time segment editing for tasks. | Drag-resize interface |
| `TaskManager.tsx` | Task template management. | CRUD interface, icons |

### Statistics & Reports (`src/features/stats/`)
| File | Functionality | Design / Aesthetic |
| :--- | :--- | :--- |
| `ComplianceReport.tsx` | Compliance metrics report. | Charts, tables |
| `CustomFieldsReport.tsx` | Reports on custom field data. | Aggregation views |
| `DailyAttendanceReport.tsx` | Daily attendance summary. | Grid view |
| `DetailedUserStats.tsx` | Individual user statistics. | Profile card with metrics |
| `LocationReport.tsx` | Location-based reporting. | Map visualization |
| `ManpowerReports.tsx` | Workforce utilization reports. | Charts, exports |
| `MissionReportModal.tsx` | Mission-specific reporting. | Form and summary |
| `PersonalStats.tsx` | Personal statistics dashboard. | KPI cards |
| `ShiftHistoryModal.tsx` | Individual shift history. | Timeline view |
| `StaffingAnalysis.tsx` | Staffing level analysis. | Gap analysis charts |
| `StatsDashboard.tsx` | Main statistics dashboard. | Tab-based navigation |
| `TaskReports.tsx` | Task completion reports. | Summary tables |

### Admin & System (`src/features/admin/`)
| File | Functionality | Design / Aesthetic |
| :--- | :--- | :--- |
| `AdminCenter.tsx` | Admin hub navigation. | Tab-based layout |
| `AdminLogsSkeleton.tsx` | Loading state for logs. | Animated skeleton |
| `AdminLogsViewer.tsx` | System audit log interface. | Filterable table |
| `GlobalStats.tsx` | Cross-organization statistics. | KPI dashboard |
| `GlobalUserManagement.tsx` | Super-admin user management. | User table, actions |
| `HomePageLayoutEditor.tsx` | Homepage widget arrangement. | Drag-drop grid |
| `LocationMap.tsx` | Interactive soldier deployment map. | Israel map SVG |
| `OrganizationLogsViewer.tsx` | Organization-specific logs. | Filtered view |
| `OrganizationMessagesManager.tsx` | Organization announcements. | Message composer |
| `OrganizationSettings.tsx` | Organization configuration. | Tabbed settings |
| `OrganizationStats.tsx` | Organization-level metrics. | Charts, summaries |
| `OrganizationUserManagement.tsx` | User role management. | Permission editor |
| `PermissionEditor.tsx` | RBAC permission editing. | Matrix interface |
| `PermissionEditorContent.tsx` | Permission form content. | Category-based |
| `SuperAdminOrgSwitcher.tsx` | Super-admin org switching. | Dropdown selector |
| `SupportTickets.tsx` | Support ticket system. | Ticket list, chat |
| `SystemMessagesManager.tsx` | System-wide messages. | Broadcast composer |
| `SystemStatsDashboard.tsx` | Platform-wide statistics. | Super-admin metrics |
| `UserActivityStats.tsx` | User engagement metrics. | Activity charts |
| `UserEditModal.tsx` | User profile editing. | Form modal |
| `analytics/AnalyticsDashboard.tsx` | Advanced analytics. | Charts, filters |
| `snapshots/SnapshotManager.tsx` | Daily snapshot management. | Archive interface |

### Battalion Management (`src/features/battalion/`)
| File | Functionality | Design / Aesthetic |
| :--- | :--- | :--- |
| `BattalionAttendanceManager.tsx` | Battalion-wide attendance. | Aggregated view |
| `BattalionDashboard.tsx` | Battalion command dashboard. | Company cards |
| `BattalionPersonnelTable.tsx` | Battalion personnel overview. | Cross-org table |
| `BattalionSettings.tsx` | Battalion configuration. | Settings form |
| `BattalionSetup.tsx` | Battalion initialization. | Setup wizard |
| `reports/BattalionMorningReport.tsx` | Daily morning report. | Printable format |

### Landing Pages (`src/features/landing/`)
| File | Functionality | Design / Aesthetic |
| :--- | :--- | :--- |
| `ContactUsPage.tsx` | Public contact page. | Marketing design |
| `NewLandingPage.tsx` | Main public landing page. | Hero, features, CTA |
| `components/BentoGrid.tsx` | Feature grid component. | Bento box layout |
| `components/HeroSection.tsx` | Hero banner. | Gradient, animations |
| `components/StickyScrollFeatures.tsx` | Scroll-reveal features. | Parallax effect |

### Special Modules
| Module | File | Functionality | Design / Aesthetic |
| :--- | :--- | :--- | :--- |
| Carpool | `carpool/CarpoolWidget.tsx` | Ride sharing coordination. | Card-based, route info |
| Equipment | `equipment/EquipmentManager.tsx` | Equipment tracking and checks. | Inventory grid, status badges |
| Lottery | `lottery/Lottery.tsx` | Fair duty lottery system. | Random selection, history |

---

## 7. App Shell & Routing (`src/App.tsx`)

### Main Views (Routes)
| View Key | Component | Description |
| :--- | :--- | :--- |
| `home` | `HomePage` | Dashboard home with widgets |
| `dashboard` | `ScheduleBoard` | Main scheduling interface |
| `attendance` | `AttendanceManager` | Attendance tracking |
| `personnel` | `PersonnelManager` | Personnel CRUD |
| `tasks` | `TaskManager` | Task template management |
| `stats` | `StatsDashboard` | Statistics and reports |
| `settings` | `OrganizationSettings` | Organization settings |
| `logs` | `AdminLogsViewer` | Audit logs (super-admin) |
| `lottery` | `Lottery` | Duty lottery |
| `constraints` | `ConstraintsManager` | Scheduling constraints |
| `faq` | `FAQPage` | FAQ page |
| `contact` | `ContactPage` | Contact form |
| `equipment` | `EquipmentManager` | Equipment management |
| `absences` | `AbsenceManager` | Leave management |
| `reports` | `BattalionMorningReport` | Morning report |
| `gate` | `GateDashboard` | Gate control |
| `admin-center` | `AdminCenter` | Admin hub |
| `admin-analytics` | `AdminCenter` | Analytics tab |
| `system` | `SystemManagementPage` | System management |

### Battalion Views
| View Key | Component | Description |
| :--- | :--- | :--- |
| `battalion-home` | `BattalionDashboard` | Battalion overview |
| `battalion-personnel` | `BattalionPersonnelTable` | Battalion people |
| `battalion-attendance` | `BattalionAttendanceManager` | Battalion attendance |
| `battalion-settings` | `BattalionSettings` | Battalion config |

### Public Routes
| Path | Component | Description |
| :--- | :--- | :--- |
| `/join/:token` | `JoinPage` | Invitation acceptance |
| `/accessibility` | `AccessibilityStatement` | Accessibility info |
| `/landing-v2` | `NewLandingPage` | Marketing page |
| `/contact` | `ContactUsPage` | Public contact |
| `*` | `MainRoute` | Authenticated app |

### Design Notes
- **Professional, military-modern aesthetic**
- **Dark and light mode support**
- **RTL (Hebrew) primary layout**
- **Glassmorphism elements**
- **IDF color scheme (olive, yellow accents)**

---

## 8. Pages (`src/pages/`)
| File | Functionality | Design / Aesthetic |
| :--- | :--- | :--- |
| `SupportTicketsPage.tsx` | Support ticket management page. | Ticket list, status |
| `SystemManagementPage.tsx` | Super-admin system page. | Management dashboard |

---

## 9. Contexts & State (`src/contexts/`, `src/stores/`)
| File | Functionality |
| :--- | :--- |
| `contexts/ToastContext.tsx` | Global toast notification state. |
| `stores/*.ts` | Zustand stores (if any). |

---

## 10. Types (`src/types.ts`)
Core TypeScript interfaces including:
- `Person`, `Team`, `Role` - Personnel entities
- `Shift`, `TaskTemplate` - Scheduling entities
- `Absence`, `SchedulingConstraint` - Constraint entities
- `Equipment`, `EquipmentDailyCheck` - Equipment tracking
- `Organization`, `Profile` - Auth/org entities
- `ViewMode`, `NavigationAction` - UI state types

---

## 11. Testing & Quality
| Directory | Purpose |
| :--- | :--- |
| `tests/` | Playwright E2E tests |
| `playwright/` | Playwright configuration |
| `*.test.ts` files | Unit tests (Vitest) |

---

## 12. File Count Summary

| Category | Count |
| :--- | :--- |
| Features - Admin | 22+ files |
| Features - Auth | 8 files |
| Features - Scheduling | 33 files |
| Features - Stats | 12 files |
| Features - Core | 9 files |
| Features - Personnel | 5 files |
| Features - Battalion | 6 files |
| Features - Landing | 5 files |
| Features - Other (carpool, equipment, lottery, tasks) | 5 files |
| Components - UI | 31 files |
| Components - Layout | 3 files |
| Components - GateControl | 5 files |
| Components - Common | 3 files |
| Services | 16 files |
| Utils | 15 files |
| Hooks | 12 files |
| **Total Source Files** | **200+** |

---

*(This documentation covers all files in the repository as of February 3, 2026)*
