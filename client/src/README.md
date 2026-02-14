# Miuim System Documentation Tree

Welcome to the **Miuim** technical documentation. This "doc tree" is designed to provide both human developers and AI assistants with a clear mental model of the system's architecture, data flow, and feature modules.

## Core Modules & Strategic Maps

Navigate to the `README.md` within each directory to understand its specific logic and responsibilities:

### 1. [Personnel Management](./features/personnel/README.md)
* **Responsibility:** Manages the "Who" of the system.
* **Entities:** People, Teams, Roles, and Custom Fields.
* **Core Logic:** Excel import/export, profile management, and team hierarchy.

### 2. [Scheduling & Attendance](./features/scheduling/README.md)
* **Responsibility:** The heartbeat of the system. Manages "When" and "Where".
* **Entities:** Shifts, Attendance Records (Presence/Absence), Constraints, and Availability.
* **Core Logic:** Real-time schedule board, automated shift generation, and attendance tracking.

### 3. [Task Management](./features/tasks/README.md)
* **Responsibility:** Defines "What" needs to be done.
* **Entities:** Task Templates, Shift Segments.
* **Core Logic:** Defining recurring tasks that can be populated with people.

### 4. [Battalion (Headquarters)](./features/battalion/README.md)
* **Responsibility:** Cross-organization oversight.
* **Entities:** Battalion-level reports, multi-company analytics.
* **Core Logic:** Aggregated attendance views (Morning Reports) and shared battalion settings.

### 5. [Admin & Infrastructure](./features/admin/README.md)
* **Responsibility:** System governance and audit.
* **Entities:** Organization Settings, Audit Logs, Analytics.
* **Core Logic:** Managing RLS-compliant organizational configurations.

### 6. [Auth & Identity](./features/auth/README.md)
* **Responsibility:** Secure access and user profiles.
* **Entities:** Users, Profiles, Permissions.
* **Core Logic:** Supabase Auth integration, onboarding flows, and invitation systems.

## Global Infrastructure
* **[Services](./services/README.md):** The data access layer (Supabase, API wrappers).
* **[Stores](./stores/README.md):** Client-side state management (Zustand).
* **[Utils](./utils/README.md):** Pure functions for dates, attendance calculations, and validations.
* **[Hooks](./hooks/README.md):** Reusable React logic (data fetching, page tracking).

---
**Tip for AI Assistants:** Before modifying code in any feature folder, ALWAYS read the `README.md` in that folder to understand the "Gotchas" and data dependencies.
