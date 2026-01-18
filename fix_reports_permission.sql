-- צעד 1: בדיקה - מי המשתמשים שצריכים עדכון? (יש לו גישה להיעדרויות צפייה אבל לא לדוחות)
SELECT id, full_name, email, permissions
FROM profiles
WHERE 
  -- מחפש מי שיש לו הרשאת צפייה בהיעדרויות
  permissions->'screens'->>'absences' = 'view' 
  -- ועדיין אין לו הגדרה לדוחות
  AND (permissions->'screens'->>'reports' IS NULL);

-- צעד 2: תיקון אוטומטי - הוספת הרשאת דוחות לכל מי שיש לו היעדרויות
UPDATE profiles
SET permissions = jsonb_set(permissions, '{screens,reports}', '"view"')
WHERE 
  permissions->'screens'->>'absences' = 'view' 
  AND (permissions->'screens'->>'reports' IS NULL);

-- בדיקה חוזרת (אמורה להחזיר 0 תוצאות)
SELECT count(*) as users_requiring_update 
FROM profiles
WHERE 
  permissions->'screens'->>'absences' = 'view' 
  AND (permissions->'screens'->>'reports' IS NULL);
