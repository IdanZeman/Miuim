# Global Design Standards & UX Guidelines

This document establishes the strict design and UX standards for the application. All future development must adhere to these guidelines to ensure consistency, ergonomics, and a premium user experience.

## 1. The Golden Standard (Layout & Actions)
**Reference Component:** `PersonnelManager.tsx`

*   **Desktop Layout:**
    *   **High-Contrast Container:** The main content must live within a white (or light) container that sits high on the screen (`pt-4` or `pt-6`), overlapping the page background.
    *   **Hero Strip:** The green header background should be minimized to a small strip (approx `h-32` to `h-40`), serving only as a visual accent behind the white content container. Global page titles are removed from the Layout and managed within the specific page if needed, or part of the white container's header.
*   **Primary Action (FAB):**
    *   **Visuals:** A perfectly round (`rounded-full`) Floating Action Button.
    *   **Color:** Yellow (`bg-amber-400`) with a distinct shadow (`shadow-xl`) and a black icon.
    *   **Position:** Fixed at the bottom corner (e.g., `fixed bottom-6 left-6` or `bottom-10` depending on viewport), floating above the content.
    *   **Consistency:** Use this FAB for the primary "Create/Add" action on **BOTH** Mobile and Desktop views. Do not use rectangular toolbar buttons for the primary creation action.

## 2. Component Consistency
*   **Date Pickers:** Must use the standardized Hebrew locale style.
*   **Dropdowns/Selects:**
    *   Rounded corners (`rounded-xl` or similar).
    *   Consistent height (`h-11` or `h-12`).
    *   Clear focus states (`focus:ring-indigo-500`).
*   **Calendars:** Maintain a uniform visual language across all calendar views (e.g., in Scheduling, Assignments).

## 3. Mobile-First & Ergonomics (Strict Requirements)

### The Thumb Zone
*   **Sticky Footers:** Critical actions (Save, Finish, Add, Confirm) must be anchored to the bottom of the screen (`fixed bottom-0` or sticky container) to be easily reachable with a thumb. Avoid placing primary actions at the top of long forms.
*   **Navigation:** Primary navigation uses the Bottom Navigation Bar. Do not use a top-left hamburger menu for primary nav (reserved for secondary/settings if deep in hierarchy).

### Typography (No Zooming)
*   **Minimum Size:** Body text and specifically **INPUTS** must never be smaller than **16px** to prevent iOS auto-zoom.
    *   *Rule:* Use `text-base` for inputs, or explicit `16px`.
*   **Line Height:** Use a leading of at least 1.5 (`leading-relaxed`) to ensure readability while moving.

### Touch Targets (The 44px Rule)
*   **Size:** Every interactive element (buttons, icons, links, toggles) must have a clickable area of at least **44x44px**.
    *   *Implementation:* Use padding or `w-11 h-11` / `min-h-[44px]` utilities.
*   **Spacing:** Maintain at least **8px** margin between adjacent buttons to prevent "fat finger" errors.

### Progressive Disclosure
*   **Accordions:** Use collapsible accordions (`<details>` or state-driven divs) for long lists or detailed info blocks to save vertical scrolling space.
*   **Bottom Sheets (Not Modals):** On mobile, **DO NOT** use centered Modals. Use **Bottom Sheets** (slide-up panels) for forms, details, and confirmations.
    *   *Reasoning:* They feel more natural on mobile and are easier to dismiss with a swipe.

### Smart Inputs
*   **Input Mode:** Always define the correct HTML `inputMode` to trigger the correct keyboard:
    *   Numeric fields (IDs, Cars): `inputMode="numeric"` or `type="tel"`.
    *   Emails: `inputMode="email"`.
    *   Search: `inputMode="search"`.
*   **Labels:** Never rely solely on Placeholders. Use **Floating Labels** or static top labels so context is never lost while typing.

### Perceived Performance
*   **Skeletons:** Never show a blank screen with a small spinner during data fetching. Use **Skeleton Loaders** (gray layout placeholders) that mimic the content structure to give the illusion of speed and stability and prevent Layout Shift (CLS).
