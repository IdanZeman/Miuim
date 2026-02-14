-- Script to Hard Delete a Person and their dependencies
-- Replace 'אברהם לוי' with the exact name if different

DO $$
DECLARE
    target_person_id UUID;
    person_name TEXT := 'אברהם לוי'; -- שם החייל למחיקה
BEGIN
    -- 1. Find the Person ID
    SELECT id INTO target_person_id
    FROM people
    WHERE name = person_name
    LIMIT 1;

    IF target_person_id IS NULL THEN
        RAISE NOTICE 'Person % not found', person_name;
        RETURN;
    END IF;

    RAISE NOTICE 'Deleting person: % (ID: %)', person_name, target_person_id;

    -- 2. Delete/Unassign Dependencies (Cascading Manual Delete)

    -- A. Scheduling Constraints
    DELETE FROM scheduling_constraints WHERE person_id = target_person_id;

    -- B. Absences
    DELETE FROM absences WHERE person_id = target_person_id;

    -- C. Hourly Blockages
    DELETE FROM hourly_blockages WHERE person_id = target_person_id;

    -- D. Daily Presence (if exists - wrapping in block in case table is missing/renamed)
    BEGIN
        DELETE FROM daily_presence WHERE person_id = target_person_id;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table daily_presence does not exist, skipping';
    END;

    -- E. Personal Rotation (if in separate table, checking code implies it's a JSON field on person, so no table delete needed)
    
    -- F. Equipment (Unassign only)
    UPDATE equipment SET assigned_to_id = NULL WHERE assigned_to_id = target_person_id;

    -- G. Shifts (Remove from assigned_person_ids array)
    -- We assume assigned_person_ids is a text[] or uuid[].
    -- 'array_remove' handles removal of all instances of the value.
    UPDATE shifts
    SET assigned_person_ids = array_remove(assigned_person_ids, target_person_id::text)
    WHERE target_person_id::text = ANY(assigned_person_ids);

    -- H. Gate Logs (if relevant)
    -- Gate logs seem to use text for driver_name, but we check if they are reporters
    -- If person is a user, we might need to check user_id, but here we only have person_id.
    -- Skipping gate_logs as they seem to link to auth.users (profiles) not public.people usually.

    -- 3. Finally, Delete the Person
    DELETE FROM people WHERE id = target_person_id;

    RAISE NOTICE 'Successfully deleted %', person_name;

END $$;
