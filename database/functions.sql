-- ============================================================================
-- FUNCTION: Complete External User Registration
-- ============================================================================
CREATE OR REPLACE FUNCTION register_external_user(
    p_username VARCHAR(63),
    p_email VARCHAR(255),
    p_password_hash CHAR(60),
    p_phone VARCHAR(14) DEFAULT NULL,
    p_name VARCHAR(63) DEFAULT NULL,
    p_dob DATE DEFAULT NULL,
    p_sex CHAR(1) DEFAULT 'U',
    p_blood_type CHAR(3) DEFAULT 'UN'
)
RETURNS TABLE (
    user_id INTEGER,
    new_patient_id INTEGER,
    result_message TEXT
) AS $$
DECLARE
    v_patient_id INTEGER;
    v_external_user_id INTEGER;
    v_patient_name VARCHAR(63);
    v_default_receptionist INTEGER;
BEGIN
    -- Validate required parameters
    IF p_username IS NULL OR p_email IS NULL OR p_password_hash IS NULL THEN
        RAISE EXCEPTION 'Username, email, and password are required';
    END IF;

    -- Check if username or email already exists
    IF EXISTS (SELECT 1 FROM external_user WHERE external_username = p_username OR external_user_email = p_email) THEN
        RAISE EXCEPTION 'Username or email already exists';
    END IF;

    -- Set patient name (use username if name not provided)
    v_patient_name := COALESCE(p_name, p_username);

    -- Get a default receptionist for creating the patient record
    SELECT emp_id INTO v_default_receptionist
    FROM internal_user
    LIMIT 1;

    IF v_default_receptionist IS NULL THEN
        RAISE EXCEPTION 'No internal user found to create patient record';
    END IF;

    -- Step 1: Create patient record
    INSERT INTO patient (
        patient_name,
        patient_email,
        patient_phone,
        patient_dob,
        patient_sex,
        patient_blood_type,
        created_by
    ) VALUES (
        v_patient_name,
        p_email,
        COALESCE(p_phone, 'NOT PROVIDED'),
        COALESCE(p_dob, '1900-01-01'::DATE),
        p_sex,
        TRIM(p_blood_type),
        v_default_receptionist
    ) RETURNING patient_id INTO v_patient_id;

    -- Step 2: Create external user account
    INSERT INTO external_user (
        external_username,
        external_user_email,
        external_user_password_hash,
        external_user_phone,
        patient_id
    ) VALUES (
        p_username,
        p_email,
        p_password_hash,
        p_phone,
        v_patient_id
    ) RETURNING external_user_id INTO v_external_user_id;

    -- Step 3: Create patient access record
    INSERT INTO patient_access (external_user_id, patient_id)
    VALUES (v_external_user_id, v_patient_id);

    -- Return success
    RETURN QUERY SELECT
        v_external_user_id,
        v_patient_id,
        'User registration successful'::TEXT;

END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Update Patient Profile (Direct)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_patient_profile(
    p_patient_id INTEGER,
    p_name VARCHAR(63) DEFAULT NULL,
    p_phone VARCHAR(14) DEFAULT NULL,
    p_dob DATE DEFAULT NULL,
    p_sex CHAR(1) DEFAULT NULL,
    p_blood_type CHAR(3) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if patient exists
    IF NOT EXISTS (SELECT 1 FROM patient WHERE patient_id = p_patient_id) THEN
        RAISE EXCEPTION 'Patient not found';
    END IF;

    -- Update only the provided fields
    UPDATE patient
    SET
        patient_name = COALESCE(p_name, patient_name),
        patient_phone = COALESCE(p_phone, patient_phone),
        patient_dob = COALESCE(p_dob, patient_dob),
        patient_sex = COALESCE(p_sex, patient_sex),
        patient_blood_type = COALESCE(TRIM(p_blood_type), patient_blood_type)
    WHERE patient_id = p_patient_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Update External User Profile
-- ============================================================================
CREATE OR REPLACE FUNCTION update_external_user_profile(
    p_external_user_id INTEGER,
    p_name VARCHAR(63) DEFAULT NULL,
    p_phone VARCHAR(14) DEFAULT NULL,
    p_dob DATE DEFAULT NULL,
    p_sex CHAR(1) DEFAULT NULL,
    p_blood_type CHAR(3) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_patient_id INTEGER;
BEGIN
    -- Get the patient_id for this external user
    SELECT patient_id INTO v_patient_id
    FROM external_user
    WHERE external_user_id = p_external_user_id;

    IF v_patient_id IS NULL THEN
        RAISE EXCEPTION 'External user not found';
    END IF;

    -- Update external_user phone if provided
    IF p_phone IS NOT NULL THEN
        UPDATE external_user 
        SET external_user_phone = p_phone 
        WHERE external_user_id = p_external_user_id;
    END IF;

    -- Call the patient update function for other fields
    RETURN update_patient_profile(v_patient_id, p_name, p_phone, p_dob, p_sex, p_blood_type);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Delete External User (Complete)
-- ============================================================================
CREATE OR REPLACE FUNCTION delete_external_user(
    p_external_user_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_patient_id INTEGER;
BEGIN
    -- Get the patient_id for the external user
    SELECT patient_id INTO v_patient_id
    FROM external_user
    WHERE external_user_id = p_external_user_id;
    
    -- Check if user exists
    IF v_patient_id IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    -- Delete related data in the correct order (child tables first)
    -- 1. Delete notifications for this user
    DELETE FROM notification WHERE external_user_id = p_external_user_id;
    
    -- 2. Delete patient_access records for this user
    DELETE FROM patient_access WHERE external_user_id = p_external_user_id;
    
    -- 3. Delete the external_user record
    DELETE FROM external_user WHERE external_user_id = p_external_user_id;
    
    -- Note: Patient record is preserved for medical records and potential future use
    -- The patient record will remain in the database even after user account deletion
    
    -- Return true if deletion was successful
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        -- Rollback any partial deletions
        RAISE EXCEPTION 'Failed to delete user: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check that all functions were created successfully
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('register_external_user', 'update_patient_profile', 'update_external_user_profile', 'delete_external_user')
AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

-- Example 1: Register with minimal information
-- SELECT * FROM register_external_user(
--     'johndoe',
--     'john@example.com',
--     '$2b$10$...password_hash...'
-- );

-- Example 2: Register with additional information
-- SELECT * FROM register_external_user(
--     'janedoe',
--     'jane@example.com',
--     '$2b$10$...password_hash...',
--     '1234567890',  -- phone
--     'Jane Doe',    -- name
--     '1990-05-15',  -- dob
--     'F',           -- sex
--     'A+'           -- blood_type
-- );

-- Example 3: Update external user profile (recommended)
-- SELECT update_external_user_profile(
--     1,  -- external_user_id
--     'John Smith',
--     '9876543210',
--     '1985-03-20',
--     'M',
--     'O+'
-- );

-- Example 4: Update patient directly (if you have patient_id)
-- SELECT update_patient_profile(
--     1,  -- patient_id
--     'John Smith',
--     '9876543210',
--     '1985-03-20',
--     'M',
--     'O+'
-- );

-- Example 4: Delete an external user (this will delete all related data)
-- SELECT delete_external_user(1);  -- where 1 is the external_user_id 