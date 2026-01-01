---
description: Unified design standard for date and time selection across the system
---

## Objective
Ensure all parts of the application that allow date or time selection utilize the project's custom UI components (`DatePicker`, `TimePicker`, `DateNavigator`). Replace native HTML elements or external libraries to maintain a premium and consistent look.

## Workflow Steps

1. **Read the File List**
   - Read `date_time_selection_files.txt` to identify all relevant locations.

2. **Iterate Through Files**
   For each file listed under categories that consume the UI (Feature Components):
   - Check if it uses standard `<input type="date">` or `<input type="time">`.
   - If yes, replace it with `DatePicker` or `TimePicker` from `src/components/ui/DatePicker.tsx`.
   - Ensure props (`label`, `value`, `onChange`) are mapped correctly.
   - Update imports at the top of the file.

3. **Handle Navigation Views**
   - Ensure every page requiring day-to-day navigation uses `DateNavigator` from `src/components/ui/DateNavigator.tsx`.
   - Ensure `CustomCalendar` is correctly displayed in multi-selection or calendar-view scenarios (e.g., `GlobalTeamCalendar`).

4. **Visual Verification**
   - For each updated file, verify the new design doesn't break the form layout.
   - Ensure colors match system definitions (Emerald for data entry, Blue for navigation/calendars).

5. **Update Status**
   - Mark each handled file in the `date_time_selection_files.txt` as "Done".

// turbo
## Recommended Execution Command
"Review the files in date_time_selection_files.txt and ensure they all use our custom DatePicker/DateNavigator components according to the workflow."
