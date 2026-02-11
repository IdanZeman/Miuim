# Analytics & Reports Module (Stats)

## 1. High-Level Purpose
* **What does this module do?** Provides data-driven insights and formal reports for organizational management. It transforms raw shifts and attendance logs into meaningful KPIs like "Readiness," "Task Load," and "Compliance."
* **Key Features:**
    * **Stats Dashboard:** High-level overview of presence, role distribution, and active tasks.
    * **Manpower Reports:** Detailed breakdown of who is where, useful for morning briefings.
    * **Task Analysis:** Insights into which tasks consume the most resources.
    * **Compliance Tracking:** Monitoring adherence to rest rules and scheduling constraints.
    * **Historical Logging:** Viewing past shift history and personal workload.

## 2. File Structure & Responsibilities
* `StatsDashboard.tsx`: The primary entry point. Orchestrates various report components.
* `ManpowerReports.tsx`: Specialized reports for personnel status (Base/Home/Leave).
* `DailyAttendanceReport.tsx`: Precise attendance breakdown by hour/location.
* `ComplianceReport.tsx`: Detailed analysis of scheduling violations (e.g., "Person worked 3 shifts in a row").
* `CustomFieldsReport.tsx`: Dynamic reports based on organization-specific custom fields.
* `ShiftHistoryModal.tsx`: Drill-down view for an individual's historical assignments.

## 3. Architecture & Data Flow
* **Incoming Data:** 
    * `shifts`, `people`, `attendance` records (passed from the global organization context).
* **Outgoing Data:** 
    * Primarily read-only, but supports exporting formatted Excel/CSV reports.
* **Backend Interactions:**
    * *Endpoints:* `rpc:fetch_organizational_stats`, `rpc:generate_historical_report`.

## 4. Dependencies & Relationships
* **Internal Dependencies:** 
    * Uses `historyService.ts` for historical trend analysis.
    * Uses `attendanceUtils.ts` to calculate current headcount.
* **External Libraries:** 
    * `recharts` (or similar): For generating visual graphs and charts.

## 5. "Gotchas" & Complexity
* **Data Refresh:** Analytics often require aggregating large datasets. Use memoization (`useMemo`) to avoid performance bottlenecks when filtering large rosters.
* **Time Context:** Most reports are date-contextual. Ensure the `selectedDate` is consistently applied across all sub-reports.
* **Headcount Snapshots:** Current "Base" count might differ from "Morning Report" count if individuals arrived/departed throughout the day. Always clarify which "Time of Day" the report represents.
