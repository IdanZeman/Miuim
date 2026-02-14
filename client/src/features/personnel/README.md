# Personnel Module

## 1. High-Level Purpose
* **What does this module do?** Manages the organizational structure and human resources of a company (Organization). It handles the CRUD operations for people, teams, and roles, as well as complex Excel-based data synchronization.
* **Key Features:**
    * **Person Management:** Tracking details, status, and custom properties of individuals.
    * **Team Organization:** Grouping people into hierarchical or functional teams.
    * **Role Definition:** Categorizing capabilities and responsibilities.
    * **Custom Fields:** Dynamic schema extension for organization-specific data.
    * **Bulk Import/Export:** Powerful Excel wizard for migrating entire company rosters.

## 2. File Structure & Responsibilities
* `PersonnelManager.tsx`: The main orchestration component. Manages tabs (People/Teams/Roles), filtering logic, and coordinate modals for editing.
* `ExcelImportWizard.tsx`: Multi-step UI for parsing, mapping, and validating Excel files before database insertion.
* `PersonnelTableView.tsx`: Optimized grid/list view for displaying personnel data with multi-select actions.
* `CustomFieldsManager.tsx`: Configuration interface for adding dynamic attributes to people entities.

## 3. Architecture & Data Flow
* **Incoming Data:** 
    * `people`, `teams`, `roles` props (typically passed from `App.tsx` or `useOrganizationData`).
    * `organizationId` for scoping database calls.
* **Outgoing Data:** 
    * Triggers updates via `onUpdatePerson`, `onAddTeam`, etc.
    * Actions eventually call `personnelService.ts` to persist changes in Supabase.
* **Backend Interactions:**
    * *Endpoints:* RPCs like `admin_fetch_audit_logs` (for history), and standard Supabase REST filters.
    * *Database:* Tables `people`, `teams`, `roles`, `custom_field_definitions`, `custom_field_values`.

## 4. Dependencies & Relationships
* **Internal Dependencies:** 
    * Relies heavily on `@/services/personnelService` for business logic.
    * Uses `@/utils/excelUtils` (internal) for file processing.
    * Uses UI components from `@/components/ui` (Button, Modal, Input).
* **External Libraries:** 
    * `xlsx`: For parsing and generating Excel files.
    * `uuid`: For generating temporary IDs before DB persistence.
    * `@phosphor-icons/react`: For consistent iconography.

## 5. "Gotchas" & Complexity
* **Dual Persistence:** Some actions might involve "optimistic updates" where state is changed locally before the DB call finishes. Check the `skipDb` flag in handlers.
* **Cascade Deletion:** Deleting a person involves complex checks for active shifts and history. See `personnelService.previewPersonDeletion`.
* **Custom Fields Logic:** Custom fields are stored in a separate EAV-like structure (`custom_field_values`). Accessing them requires mapping IDs to keys.
* **Excel Mapping:** The import wizard uses a fuzzy-matching strategy to map Excel headers to database columns. Be careful when modifying the `MAPPING_SCHEMA`.
