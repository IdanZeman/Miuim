# Role-Based Access Control (RBAC) System - Technical Documentation

This document describes the architecture of the Role-Based Access Control (RBAC) system within the application, which has replaced the use of legacy binary flags (such as `isCommander`). The system provides maximum flexibility in defining access to screens and data.

## 1. Overview
The RBAC system is designed to provide granular control over what a user can see and edit within an organization.
Instead of relying on rigid roles ("Admin", "Viewer"), each user is assigned a `UserPermissions` object that explicitly defines their capabilities.
For management convenience, we use **Permission Templates**, allowing the definition of "roles" (e.g., Platoon Commander, Deputy, Logistics NCO) and their assignment to multiple users.

## 2. Core System: The Permissions Object (`UserPermissions`)
All checks in the system are based on the `UserPermissions` interface (defined in `src/types.ts`):

```typescript
export interface UserPermissions {
  // The scope of data the user is exposed to
  dataScope: 'organization' | 'battalion' | 'team' | 'personal' | 'my_team';
  
  // (Optional) If Scope is 'team', which team IDs are allowed
  allowedTeamIds?: string[]; 
  
  // Per-screen permissions: 'view', 'edit', or 'none' (default)
  screens: Partial<Record<ViewMode, AccessLevel>>; 
  
  // Special flags for specific actions
  canApproveRequests?: boolean;       // Approve requests (vacation, etc.)
  canManageRotaWizard?: boolean;      // Access to the automatic scheduling wizard
  canManageGateAuthorized?: boolean;  // Manage authorized vehicles at the gate
}
```

### Data Scopes (`dataScope`)
*   `organization`: Access to all company/organization data.
*   `battalion`: Access to battalion-level data (relevant for Battalion HQ).
*   `team` / `my_team`: Restricted access to a specific team (e.g., a platoon commander seeing only their platoon).
*   `personal`: The user sees only their own data.

## 3. Permission Templates
To avoid manual configuration for every user, we use templates.
*   **Database**: `permission_templates` table.
*   **Usage**: When a template is assigned to a user, a copy of the permissions is saved to the user's profile (`profiles.permissions`), but the Template ID (`permission_template_id`) is also retained to allow for future bulk updates.

The system comes with pre-defined system templates (in `src/utils/permissions.ts`):
*   **Admin**: Full access to everything.
*   **Editor**: Content editing access, without access to organization settings or system logs.
*   **Viewer**: Read-only access.
*   **Attendance Manager**: Focused access for attendance management only.

## 4. Access Check Mechanism (`checkAccess`)
The central function for checking permissions is `checkAccess` from the `useAuth` Hook.

### Function Signature:
```typescript
checkAccess(screen: ViewMode, requiredLevel?: 'view' | 'edit'): boolean
```

### Internal Logic:
1.  **Screen Mapping**: The system maps various screens to a primary permission key.
    *   `battalion-home`, `battalion-settings`, etc. -> mapped to `battalion`.
    *   `absences` -> mapped to `attendance`.
2.  **Exceptions**: Screens like `home`, `dashboard` are open to everyone by default (unless configured otherwise).
3.  **Super Admin**: A user marked as `is_super_admin` always has access to everything.
4.  **Granular Check**: The function checks `profile.permissions.screens` to see if a suitable permission (`view` or `edit`) exists for the requested screen.

## 5. Frontend Usage

### Component Access Check
```tsx
const { checkAccess } = useAuth();

// Show edit button only to those with 'edit' permission for equipment
{checkAccess('equipment', 'edit') && (
  <button onClick={handleEdit}>Edit Equipment</button>
)}

// Hide link in menu
{checkAccess('settings') && (
  <Link to="/settings">Settings</Link>
)}
```

### Template Management (Admin UI)
The `OrganizationSettings` component contains the logic for creating and editing templates (in the "Permission Templates" tab).
*   New templates can be created defining which screens are open and at what level.
*   Templates can be restricted to a specific team (`team scope`) or open to the entire organization.

## 6. Database Structure
Relevant tables in Supabase:

### `profiles`
Contains user information and their specific permissions.
*   `permissions` (JSONB): The full permissions object. This is the actual Runtime Source of Truth.
*   `permission_template_id` (UUID): Reference to the original template (for UI and management purposes).

### `permission_templates`
Contains organization-level template definitions.
*   `organization_id`: The template belongs to a specific organization.
*   `name`: Role name (e.g., "Platoon Commander").
*   `permissions` (JSONB): The permissions definition for the template.

## 7. Migration Summary (Removal of `isCommander`)
Previously, the system used a boolean flag `isCommander` to identify commanders. This flag has been **completely removed**.
Now, a "Commander" is simply a user who has a permission template granting them `edit` access to relevant screens, and potentially `dataScope: 'team'` (if they are a junior commander) or `organization` (if they are a company commander).
This change allows flexibility—you can create a "Logistics Commander" who only has access to equipment, or a "Training Commander" who only has access to the training schedule, without any code changes.

## 8. Full Permission Reference

### List of Controls (Screens)
The following keys are used in `screens` to control access to specific pages or modules:

| Permission Key | Description | Default Level |
| :--- | :--- | :--- |
| `home` | Landing page | Open |
| `dashboard` | Main roster/shift board | Open |
| `personnel` | Soldier management (People, Roles, Teams) | Edit (Admin/Editor) |
| `attendance` | Daily attendance and absences | Edit (Admin/Editor) |
| `tasks` | Task definition and settings | Edit (Admin/Editor) |
| `stats` | Reports and analytics dashboard | View (All) |
| `settings` | Organization settings (Invites, Templates) | Edit (Admin only) |
| `equipment` | Logistics and equipment management | Edit (Admin/Editor) |
| `lottery` | Fair usage lottery system | Edit (Admin/Editor) |
| `constraints` | Management of user constraints | Edit (Admin/Editor) |
| `logs` | System audit logs | Edit (Admin only) |
| `reports` | Mission reports module | View/Edit |
| `contact` | Contact/Support page | Open |
| `gate` | Guard gate interface (mobile friendly) | Open |
| `system` | Super-Admin system management | None (Super Admin only) |
| `battalion` | **Unified Battalion Access** (covers `battalion-home`, `battalion-personnel`, `battalion-attendance`, `battalion-settings`) | Edit (HQ only) |

### Special Capability Flags
These boolean flags in `UserPermissions` control specific functional capabilities beyond screen access:

*   **`canApproveRequests`**: Allows the user to approve or reject pending requests (e.g., vacation requests, constraint changes).
*   **`canManageRotaWizard`**: Grants access to the algorithmic auto-scheduler (Planner/Wizard).
*   **`canManageGateAuthorized`**: Grants permission to add/remove authorized vehicles in the Gate Interface.
