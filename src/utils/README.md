# Utils Module

## 1. High-Level Purpose
* **What does this module do?** Contains "pure" helper functions, business rules, and shared logic that do not depend on React state or specific backend services. This is the "Brain" of the system's logic.
* **Key Features:**
    * **Date Manipulation:** Comprehensive tools for Israel-localized date formatting and timezone handling.
    * **Attendance Logic:** Centralized rules for determining if a person is "present".
    * **Assignment Validation:** Rules engine for checking shift conflicts and rest periods.
    * **Excel Processing:** Logic for parsing and generating report files.

## 2. Core Utilities
* `attendanceUtils.ts`: The **Source of Truth** for headcount. Defines `isPersonPresentAtHour` and `getEffectiveAvailability`.
* `dateUtils.ts`: Wrappers around `date-fns` for consistent Israel-time formatting (`formatIsraelDate`).
* `assignmentValidation.ts`: The "Rules Engine". Contains `validateAssignment` to check for overlapping shifts and rest violations.
* `shiftUtils.ts`: Logic for generating shift instances from task templates.
* `excelUtils.ts`: Domain-specific Excel generation (shifts, attendance, personnel).
* `permissions.ts`: Logic gates for user rights (e.g., `canManageOrganization`).

## 3. Architecture & Data Flow
* **Input:** Typically structured objects (Shifts, People, Dates).
* **Output:** Booleans (valid/invalid), Formatted strings, or derived state objects.

## 4. Dependencies
* `date-fns`: The primary external library for date logic.
* `xlsx`: For file generation.

## 5. "Gotchas" & Complexity
* **Timezone Sensitivity:** Miuim is designed for Israel Time (UTC+2/+3). Always use `formatIsraelDate` or `normalizeTime` when displaying dates to users.
* **Attendance Engine Versions:** `attendanceUtils.ts` supports multiple logic engines. When adding new status types, update the `AttendanceDisplayInfo` interface to maintain consistency across the UI.
* **Headcount Rules:** A person is "Present" if they have a base status AND their arrival/departure times cover the check-time AND they don't have an approved absence at that time. NEVER implement this logic outside of `attendanceUtils.ts`.
* **RTL Strings:** Be careful when concatenating English/Hebrew strings or numbers. Use bidirectional-safe formatting.
