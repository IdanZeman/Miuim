# Services Layer

## 1. High-Level Purpose
* **What does this module do?** The Services Layer acts as the "Data Access Layer" (DAL) for Miuim. It abstracts communication with Supabase, handles complex business logic (like the scheduling algorithm), and ensures data consistency through mappers and validation.
* **Key Capabilities:**
    * **Data Fetching:** Standardized hooks and functions for retrieving entities.
    * **Business Logic:** Complex operations like shift generation, snapshot restoration, and scheduling suggestions.
    * **State Mapping:** Converting database-friendly rows (snake_case) to client-friendly entities (camelCase).

## 2. Core Services
* `supabaseClient.ts`: Initializes the Supabase client and defines the **Mappers** (the most critical part of data flow).
* `personnelService.ts`: Logical operations for People, Teams, and Roles. Includes deletion previews and archiving logic.
* `shiftService.ts`: CRUD for shifts, bulk updates, and draft publishing.
* `attendanceService.ts`: Synchronizing presence data and handling bulk attendance RPCs.
* `schedulingService.ts`: The bridge for the auto-scheduling engine and constraint management.
* `snapshotService.ts`: Logic for creating and restoring full-state backups.
* `loggingService.ts`: Centralized audit and application logging (debounced and batched).
* `scheduler/index.ts`: The actual assignment algorithm (the "Brain").

## 3. Data Mappers (Crucial Concept)
Miuim uses a strict separation between Database types and Frontend types. 
* **DB Types:** Snake-case (e.g., `is_active`, `start_date`).
* **UI Types:** Camel-case (e.g., `isActive`, `startDate`).

Every service MUST use the mappers from `supabaseClient.ts` (e.g., `mapPersonFromDB`, `mapPersonToDB`) to ensure consistency. Failure to map will cause TypeScript errors and runtime logic bugs.

## 4. Backend-Frontend Relationship
* **Supabase REST:** Used for simple CRUD operations.
* **PostgreSQL RPCs:** Used for complex, transactional, or resource-heavy operations (e.g., `v2_sync_attendance`, `fetch_organizational_data`).
* **Edge Functions:** Used for external integrations (e.g., sending WhatsApp messages).

## 5. "Gotchas"
* **Optimistic Updates:** Many services return the *calculated* result before the database confirms (especially in Draft Mode).
* **Cascade Conflicts:** Modifying one entity (e.g., a Role) might affect many others (Shifts requiring that role). Services often include "Impact Previews."
* **Concurrency:** Use `refreshData` (from React Query) after write operations to ensure the UI stays in sync with the source of truth.
