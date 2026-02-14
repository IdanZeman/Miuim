# Auth & Identity Module

## 1. High-Level Purpose
* **What does this module do?** Provides the security backbone of Miuim. It manages user authentication, profile resolution, organizational context, and the central "Access Gatekeeper" for all UI features.
* **Key Features:**
    * **User Session Management:** Handling sign-in, sign-up, and session persistence via Supabase.
    * **Profile & Permission Hydration:** Fetching the user's role and granular permissions upon login.
    * **Onboarding Flow:** A multi-step wizard for new users to create an organization or join an existing one via invite.
    * **Access Control Hook:** A unified `checkAccess` function used throughout the app to conditionally show/hide UI based on user rights.

## 2. File Structure & Responsibilities
* `AuthContext.tsx`: The heart of auth logic. Wraps the app in a provider that exposes the current `user`, `profile`, and `organization`.
* `Onboarding.tsx`: The entry point for users without an organization. 
* `OnboardingWizard.tsx`: Guides users through setting up their company (naming, initial teams, and first personnel import).
* `JoinPage.tsx`: Handles unique invitation links and processes user requests to join specific organizations.
* `ClaimProfile.tsx`: Logic for "claiming" a placeholder soldier profile when a real user signs up.

## 3. Architecture & Data Flow
* **Incoming Data:** 
    * Supabase Auth `User` object.
    * Real-time auth state changes from `supabase.auth.onAuthStateChange`.
* **Outgoing Data:** 
    * Exposes `user`, `profile`, and `organization` to the entire component tree.
* **Backend Interactions:**
    * *Database:* Tables `profiles`, `organizations`, `organization_invites`.

## 4. Dependencies & Relationships
* **Internal Dependencies:** 
    * Uses `authService.ts` for profile updates and organization creation.
    * Uses `analytics.ts` and `loggingService.ts` to track login/onboarding events.
* **External Libraries:** 
    * `@supabase/supabase-js`: The core client library for auth.

## 5. "Gotchas" & Complexity
* **Recursive Loading:** The app cannot load organizational data until the `profile` is fetched. The `AuthProvider` handles this multi-stage initialization (Auth -> Profile -> Organization).
* **Placeholder Profiles:** A soldier might exist in the `people` table *before* they have a registered user account. The "Claim Profile" logic handles linking a `supabase.auth.user` to an existing `person` entry.
* **Permission Mapping:** Permissions are derived from the `profiles` table. The `checkAccess` logic is the **only** place where view-level security should be implemented; always verify on the server side (RLS) as well.
* **Organization Switching:** If a user belongs to multiple organizations (via Battalion access), `AuthContext` provides the logic to refresh the context when the `activeOrgId` changes.
