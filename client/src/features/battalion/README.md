# Battalion (HQ) Module

## 1. High-Level Purpose
* **What does this module do?** Provides a "command-level" overview for battalion headquarters. It aggregates data from multiple organizations (companies) into a single unified dashboard, allowing for cross-company headcount, readiness tracking, and unified configuration.
* **Key Features:**
    * **Consolidated Dashboard:** Real-time stats across all companies (Headcount, Readiness, Recovery).
    * **Morning Reports:** Automated generation of battalion-wide attendance reports.
    * **Battalion Personnel:** A unified view of all soldiers assigned to the battalion, regardless of company.
    * **Global Settings:** Managing battalion-level configurations (e.g., Company Switcher permissions).

## 2. File Structure & Responsibilities
* `BattalionDashboard.tsx`: The primary "at-a-glance" view. Displays critical KPIs and handles high-level navigation between battalion features.
* `BattalionAttendanceManager.tsx`: A matrix view showing attendance status across all organizations within the battalion.
* `BattalionPersonnelTable.tsx`: A searchable, filterable list of all personnel in the battalion.
* `BattalionSettings.tsx`: Configuration interface for battalion-specific flags and company management.
* `reports/BattalionMorningReport.tsx`: UI for generating and viewing consolidated presence reports for formal reporting.

## 3. Architecture & Data Flow
* **Incoming Data:** 
    * `useBattalionData` hook: Fetches aggregated data for all companies associated with the user's `battalion_id`.
* **Outgoing Data:** 
    * Battalion settings updates and cross-company personnel transfers.
* **Backend Interactions:**
    * *Endpoints:* `rpc:fetch_battalion_analytics`, `rpc:generate_battalion_report`.
    * *Database:* Tables `battalions`, `organizations`, `people`.

## 4. Dependencies & Relationships
* **Internal Dependencies:** 
    * Relies on the same `attendanceUtils.ts` used by individual companies to ensure consistent logic.
    * Uses `battalionService.ts` for specialized multi-org queries.
* **Organizational Hierarchy:** A `Battalion` contains multiple `Organizations`. Real-time data is fetched using specific RPCs that bypass standard single-org filters.

## 5. "Gotchas" & Complexity
* **Performance:** Loading data for an entire battalion (hundreds of soldiers across several companies) can be intensive. The module uses skeletons and optimized hooks to maintain responsiveness.
* **Permission Isolation:** A battalion user might have access to see data from all companies, but "Company Admin" users are typically restricted to their own organization.
* **Sync Frequency:** Ensure battalion views handle "stale" data gracefully, as real-time updates from individual companies might take a moment to propagate to aggregated views.
