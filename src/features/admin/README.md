# Admin & Infrastructure Module

## 1. High-Level Purpose
* **What does this module do?** Handles the governance, security, and auditing of an organization. It manages permissions, user roles, organizational constraints, and high-fidelity history tracking (snapshots/logs).
* **Key Features:**
    * **Organization Settings:** Global toggle for features like "Manual Rota Wizard," "V2 Attendance," and "Company Switcher."
    * **Permission Management:** Granular control over what users can see and do using a Template-based system.
    * **Log Viewer:** A searchable audit trail of every meaningful action (Create/Update/Delete) within the organization.
    * **Snapshot Management:** High-fidelity backups of the entire organizational state (Shifts, People, Attendance) for disaster recovery or historical review.
    * **Invite System:** Managing secure join links and initial role templates for new members.

## 2. File Structure & Responsibilities
* `OrganizationSettings.tsx`: The primary configuration hub. Organizes various admin sub-sections (General, Permissions, Battalion Association).
* `AdminLogsViewer.tsx`: Specialized UI for filtering and viewing detailed audit records fetched from the database.
* `PermissionEditorContent.tsx`: UI for defining specific boolean flags for user capabilities (e.g., `can_edit_shifts`, `can_manage_personnel`).
* `snapshots/SnapshotManager.tsx`: Interface for creating, viewing, and restoring point-in-time backups.
* `OrganizationMessagesManager.tsx`: Managing system-wide broadcasts or banners for the organization.

## 3. Architecture & Data Flow
* **Incoming Data:** 
    * User profile, organizational metadata, and existing permission templates.
* **Outgoing Data:** 
    * Updates to the `organizations` table.
    * Updates to user `profiles` (permissions/roles).
    * Snapshot creation and restoration requests.
* **Backend Interactions:**
    * *Endpoints:* `rpc:admin_fetch_audit_logs`, `rpc:restore_snapshot`, `rpc:create_snapshot`.
    * *Database:* Tables `organizations`, `profiles`, `permission_templates`, `audit_logs`, `snapshots`.

## 4. Dependencies & Relationships
* **Internal Dependencies:** 
    * Uses `adminService.ts` and `snapshotService.ts`.
    * Heavily relies on `permissions.ts` utility for logic-gate checks (e.g., `canManageOrganization`).
* **Supabase Integration:** Uses Supabase Auth combined with custom RLS (Row Level Security) policies enforced via the `organization_id` on every table.

## 5. "Gotchas" & Complexity
* **Permission Precedence:** A user's effective permissions are a merge of their individual profile flags and their assigned template. If a template is changed, it affects all users linked to it.
* **Snapshot Restoration Risk:** Restoring a snapshot is a destructive action that overwrites current data. The system enforces "Snapshot Pinning" to prevent accidental overrides of historical records.
* **Audit Log Volume:** Logging is expansive. The `loggingService.ts` handles debouncing and batching to avoid flooding the DB with minor UI state changes.
* **Battalion Linkage:** Removing an organization from a battalion is a sensitive action that affects RLS visibility for HQ users.
