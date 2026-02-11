# Task Management Module

## 1. High-Level Purpose
* **What does this module do?** Defines the "work blueprints" of the organization. Tasks act as templates that specify what kind of roles and people are needed for specific activities (e.g., "Guard Duty," "Kitchen Patrol").
* **Key Features:**
    * **Task Template CRUD:** Creating and configuring recurring tasks.
    * **Segment Definition:** Breaking a task down into time-based segments (e.g., "Night Shift," "Morning Shift").
    * **Requirements Mapping:** Linking tasks to specific roles (e.g., "Requires 2 Combatants").

## 2. File Structure & Responsibilities
* `TaskManager.tsx`: The main management interface for organizational tasks. Handles the list of templates, duplication logic, and coordinate creation modals.
* `SegmentEditor.tsx`: A specialized sub-component for managing the complex timing and requirements of individual task segments.

## 3. Architecture & Data Flow
* **Incoming Data:** 
    * `tasks` (TaskTemplate array), `roles` (for requirement mapping), `teams`.
* **Outgoing Data:** 
    * Triggers `onAddTask`, `onUpdateTask`, `onDeleteTask`.
* **Backend Interactions:**
    * *Database:* Table `task_templates`, `task_segments` (often stored as JSON or related tables depending on schema).

## 4. Dependencies & Relationships
* **Internal Dependencies:** 
    * Heavily used by the **Scheduling** module to generate actual `Shift` instances.
    * Uses `taskService.ts` for persistence.

## 5. "Gotchas" & Complexity
* **Templates vs. Shifts:** A `TaskTemplate` is the definition. A `Shift` is a concrete instance of that task at a specific time. Modifying a template DOES NOT automatically update existing shifts generated from it.
* **Segment Timing:** Segments define the structure of the Rota. Ensure overlapping segments are handled carefully in the UI, as they can cause scheduling conflicts.
* **Requirements Logic:** Task requirements (roles/count) are critical for the **Auto-Schedule** algorithm. If a task requires a "Medic" but no Medics are available, the algorithm will skip or flag it.
