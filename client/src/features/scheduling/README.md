# Scheduling & Attendance Module

## 1. High-Level Purpose
* **What does this module do?** This is the core engine of Miuim. it manages real-time deployment (Shifts), personnel availability (Attendance), and complex scheduling constraints to ensure operational readiness.
* **Key Features:**
    * **Schedule Board:** A real-time, drag-and-drop interface for managing shifts and assignments.
    * **Draft Mode:** A "sandbox" environment where commanders can plan schedules without affecting live data until "Published".
    * **Attendance Management:** Tracking who is at the base, at home, or in transit (Arrival/Departure), supporting multiple logic engines (V1, V2 Simplified).
    * **Auto-Scheduling:** Algorithmic assignment of people to shifts based on roles, team organic-ness, and rest rules.
    * **War Clock:** A high-level visual representation of time and critical milestones.

## 2. File Structure & Responsibilities
* `ScheduleBoard.tsx`: The primary UI for shift management. Handles view modes (Timeline, List, Weekly), Draft sync, and coordinate shift modals.
* `AttendanceManager.tsx`: Specialized view for managing the daily presence of entire teams. Interfaces with the `daily_presence` table.
* `AttendanceTable.tsx`: Optimized, potentially virtualized grid for high-density attendance data entry.
* `ConstraintsManager.tsx`: Interface for defining global or person-specific scheduling rules (e.g., "Must have 6 hours of rest").
* `AbsenceManager.tsx`: Handles long-term leave requests and approvals.
* `RotaWizardModal.tsx`: A guided flow for generating recurring shift patterns (Rotas).
* `WarClock.tsx`: A dashboard component for time tracking and countdowns.

## 3. Architecture & Data Flow
* **Incoming Data:**
    * `shifts`, `people`, `taskTemplates`, `teamRotations`, `absences`.
    * Attendance status is derived via `getEffectiveAvailability` in `attendanceUtils.ts`.
* **Outgoing Data:**
    * Triggers shift assignments, updates, and attendance status changes.
    * Manages "Draft State" locally before persisting to the `shifts` table.
* **Backend Interactions:**
    * *Endpoints:* `rpc:v2_sync_attendance` (for bulk updates), `rpc:fetch_organizational_data` (for initial load).
    * *Database:* Tables `shifts`, `daily_presence`, `absences`, `task_templates`, `scheduling_constraints`.

## 4. Dependencies & Relationships
* **Internal Dependencies:**
    * **Calculations:** Heavily dependent on `@/utils/attendanceUtils.ts` and `@/utils/shiftUtils.ts`.
    * **Validation:** Uses `@/utils/assignmentValidation.ts` to check for conflicts (rest violations, etc.).
    * **Services:** Uses `schedulingService.ts` and `shiftService.ts`.
* **External Libraries:**
    * `date-fns`: Extensive date manipulation.
    * `@phosphor-icons/react`: UI Icons.
    * `uuid`: For temporary shift/draft IDs.

## 5. "Gotchas" & Complexity
* **Engine Versions:** The system supports `v1_legacy` and `v2_simplified`. The logic for "Am I present?" changes significantly between them. AI should check the `engine_version` from organization settings.
* **Draft Mode Logic:** In `ScheduleBoard`, the state `draftStore` keeps track of local modifications. These are NOT reflected in the global `shifts` array until `handlePublishDraft` is called.
* **Headcount Derivation:** Physical presence at any given minute is a calculation of `daily_presence` (status/times) + `absences` (approved) + `hourly_blockages`. Use `isPersonPresentAtHour` as the source of truth.
* **RTL Time Grid:** The timeline view in `ScheduleBoard` uses custom pixel calculations (`getPositionFromTime`). Be careful with horizontal offsets in RTL layouts.
