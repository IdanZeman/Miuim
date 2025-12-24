# Maintenance Protocol

This file serves as a strict protocol for the AI Agent and developers working on the **Miuim** project.

## 1. Documentation & FAQs
> [!IMPORTANT]
> **Rule for Agent:** Every time a feature is modified, added, or removed in the codebase, you MUST update the `components/FAQPage.tsx` file to reflect these changes in the user guide.

### How to Update
1.  **Identify Changes:** deeply understand how the new/modified feature works from the user's perspective.
2.  **Locate Section:** Find the relevant category in `FAQPage.tsx` (e.g., `personnel`, `tasks`, `scheduling`).
3.  **Update Content:**
    *   If a feature changed: Update the existing steps to match the new flow.
    *   If a feature was added: Add a new question/topic to the relevant section.
    *   If a feature was removed: Remove the corresponding documentation.
4.  **Verify:** Ensure that the instructions are clear, in Hebrew, and use the correct terminology (same as used in the UI).

---

## 2. Security & Permissions (RBAC)
> [!CRITICAL]
> **Strict Security Rule:** Every new feature, page, or API interaction MUST be protected by the Role-Based Access Control (RBAC) system.

### The RBAC Model
*   **User Roles:** `admin`, `editor`, `viewer`, `attendance_only` (See `types.ts`).
*   **Permissions Object:** `profile.permissions` overrides generic roles.
*   **Access Check:** `checkAccess(viewMode, 'view' | 'edit')`.

### Protocol for Changes
1.  **Deny by Default:**
    *   Assume NO ONE has access to a new feature unless explicitly granted.
    *   Never create a "public" route or component without confirmation.

2.  **Implement Access Checks:**
    *   **UI Elements:** Wrap buttons and sensitive data in `checkAccess(...)` conditions.
    *   **Routing:** In `App.tsx`, ensure the route is guarded (e.g., redirect to home or show `<Shield>` error if `!checkAccess`).
    *   **Data Scoping:** Respect `dataScope` ('organization', 'team', 'personal') when fetching data in `services/supabaseClient.ts` or `App.tsx`.

    *   **DO NOT GUESS.** Guessing leads to security vulnerabilities.

---

## 3. Design & UI Standards
> [!TIP]
> **Aesthetic Rule:** All new pages must strictly follow the application's "Premium Soft" design language.

### Key Tokens & Classes
*   **Page Container:** Use `max-w-5xl mx-auto p-4 md:p-8` for the main wrapper.
*   **Headers/Hero:** Use `rounded-3xl` for main page headers with `shadow-sm`.
*   **Cards/Sections:** Use `bg-white rounded-2xl shadow-sm border border-slate-100`.
*   **Interactions:** Add `hover:shadow-md transition-all duration-300` for interactive elements.
*   **Spacing:** Use generous padding (`p-6` or `p-8`) to let content breathe.
*   **Typography:** Use `font-black` or `font-bold` for headings, and `text-slate-500` for subtitles.

### Example Structure
```tsx
<div className="h-full overflow-y-auto bg-slate-50">
  <div className="max-w-5xl mx-auto p-8">
    
    {/* Header */}
    <header className="bg-white rounded-3xl p-8 shadow-sm mb-8">
       <h1 className="text-3xl font-black">Title</h1>
    </header>

    {/* Content */}
    <div className="bg-white rounded-2xl p-6 shadow-sm">
       {/* ... */}
    </div>
  </div>
</div>
```

---

## 4. Logging & Monitoring Protocol
> [!IMPORTANT]
> **Audit Rule:** All state changes, errors, and critical user actions must be logged for security and debugging.

### When to Log
1.  **State Changes (CRUD):** Every Create, Update, Delete operation on a core entity (Person, Shift, Team, etc.) must be logged.
2.  **User Interactions:** Significant UI interactions like clicking main action buttons (Login, Export, Clear Day) or switching major views.
3.  **Errors:** All caught exceptions in `try/catch` blocks must be logged via `logger.logError`.
4.  **System Events:** Login, Logout, and specialized system actions like "Auto Schedule".

### How to Log
Use the `loggingService` (import `{ logger }`). **Do not** use `console.log` for persistent logging.

#### Standard Actions
Use helper methods for standard CRUD operations to ensure consistency:
```typescript
logger.logCreate('person', id, name, data);
logger.logUpdate('shift', id, name, oldData, newData);
logger.logDelete('team', id, name, metadata);
```

#### Custom Events
For other events, use the generic `log` method:
```typescript
logger.log({
    action: 'CLICK',
    entityType: 'button',
    entityName: 'export_csv',
    category: 'ui'
});
```

#### Errors
Always include the error object and a context string:
```typescript
try {
    // ...
} catch (e) {
    logger.logError(e, 'ComponentName:FunctionName');
}
```

### Log Levels
*   **FATAL / ERROR**: System crashes, data corruption, API failures.
*   **WARN**: Business rule violations (e.g., assignment conflict ignored), performance warnings.
*   **INFO**: Standard user actions (Login, Create, Update, Assign). This is the default.
*   **DEBUG**: Detailed state transitions, useful for development.

### Privacy & Security
*   **No Passwords**: Never log passwords or sensitive tokens.
*   **Session Tracking**: The logging service automatically attaches a `sessionId` to track anonymous and authenticated journeys.
```
