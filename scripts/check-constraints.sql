-- Check current constraints on plan_participants table
SELECT
    conname as constraint_name,
    pg_get_constraintdef(c.oid) as constraint_definition
FROM
    pg_constraint c
JOIN
    pg_class t ON c.conrelid = t.oid
WHERE
    t.relname = 'plan_participants'
    AND c.contype = 'c'; -- 'c' for check constraints

-- Also check the column definition
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM
    information_schema.columns
WHERE
    table_name = 'plan_participants'
    AND table_schema = 'public'
    AND column_name = 'status';
