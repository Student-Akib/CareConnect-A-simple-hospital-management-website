-- ============================================================================
-- FUNCTION CLEANUP SCRIPT
-- ============================================================================
-- This script drops all existing functions in the public schema
-- Run this before running functions.sql to ensure a clean slate

-- Drop all existing functions in the public schema
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN
        SELECT ns.nspname as schema_name, p.proname as func_name,
               pg_get_function_identity_arguments(p.oid) as func_args
        FROM pg_proc p
        LEFT JOIN pg_namespace ns ON p.pronamespace = ns.oid
        WHERE ns.nspname = 'public'  -- schema name
          AND p.prokind = 'f'        -- Only functions
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE',
                      func_record.schema_name,
                      func_record.func_name,
                      func_record.func_args);
    END LOOP;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check that all functions were dropped
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION';

-- This should return no rows if cleanup was successful 