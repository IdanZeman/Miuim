# Modal Design Specification & UI Standards

This document defines the unified design language for all modals within the application to ensure visual consistency and a premium user experience. The standard is based on the **War Clock Item Modal** architecture.

## 1. Header (Sticky)
*   **Background:** Clean white (`bg-white`).
*   **Border:** Subtle bottom separator (`border-b border-slate-100`).
*   **Typography:** Bold, prominent title in slate gray (`text-xl md:text-2xl font-bold text-slate-800`).
*   **Close Button (X):** 
    *   **Position:** Top-left corner (in RTL layouts) or Top-right (in LTR).
    *   **Style:** Ghost rounded-full button.
    *   **Colors:** Slate-400 by default, Slate-600 on hover.
    *   **Interaction:** Transparent background, `hover:bg-slate-100`.
    *   **Size:** Target area of 44-48px for accessibility. Icon size: 24.
*   **Padding:** `p-4 md:p-6`.

## 2. Main Content (Body)
*   **Background:** White (`bg-white`).
*   **Padding:** `p-4 md:p-6` (matching the header's horizontal alignment).
*   **Vertical Rhythm:** Use `space-y-6` between major form sections to provide "breathing room" (negative space).
*   **Form Structure:**
    *   **Labels:** Small, bold, uppercase, slate-500 (`text-xs font-bold text-slate-500 uppercase tracking-wider`).
    *   **Field Grouping:** Use Grids for related fields (e.g., Start/End times): `grid grid-cols-2 gap-4`.
    *   **Inputs/Selects:** Use consistent components (`Input`, `Select`, `TimePicker`) with rounded-xl corners.

## 3. UI Components & Patterns
*   **Segmented Controls (Tabs):** 
    *   Container: Slate-100 background with `p-1 rounded-xl`.
    *   Active State: White background (`bg-white`), primary blue text (`text-blue-600`), and subtle `shadow-sm`.
*   **Badges/Statuses:** Small, pill-shaped with bold text and tracking-wider (`rounded-full px-3 py-1 text-[10px] md:text-xs font-black uppercase tracking-wider`).
*   **Interactive Elements:** Use `active:scale-95` or `active:scale-90` for tactile feedback.

## 4. Footer (Sticky)
*   **Background:** Very light slate-50 (`bg-slate-50`).
*   **Border:** Top separator (`border-t border-slate-100`).
*   **Shape:** Bottom corners rounded to match the modal container (`rounded-b-2xl`).
*   **Alignment:** 
    *   Primary actions: `justify-end` with `gap-2` or `gap-3`.
    *   Destructive actions (e.g., Delete): Positioned at the opposite end (`justify-between`).
*   **Buttons:**
    *   **Cancel/Close:** Ghost variant (text only, slate-500).
    *   **Primary (Save/Submit):** Bold solid color (usually primary blue) with `shadow-sm` and `px-6` padding.
    *   **Delete/Danger:** Danger variant (red text/outline).

## 5. Vertical Spacing & Safe Areas
*   **Max Height:** To prevent the modal from feeling claustrophobic, it must never occupy 100% of the viewport height.
    *   **Standard Modals:** `max-h-[85vh]`.
    *   **Large/Full Modals:** `max-h-[92vh]` (on mobile) or `h-[90vh]` (on desktop).
*   **Top Margin:** Ensure a visible gap at the top (at least 8-10% of screen height) to maintain context of the underlying page and provide a natural "pull-to-dismiss" feel on mobile.

## 6. Unified Component Architecture
To ensure site-wide consistency, all feature modals MUST utilize the central `GenericModal` component. Avoid manual re-implementation of headers and footers. The central component handles:
*   Sticky positioning of sections.
*   Standardized padding and border colors.
*   Responsive transitions and radius.

---

By adhering to these standards, we maintain a cohesive "premium" feel across the entire application.
