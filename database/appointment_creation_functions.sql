-- ============================================================================
-- APPOINTMENT CREATION FUNCTIONS
-- ============================================================================

-- ============================================================================
-- FUNCTION: Get All Doctors (Basic Information for Selection)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_all_doctors()
RETURNS TABLE (
    doctor_id INTEGER,
    doctor_name VARCHAR(63),
    department_name VARCHAR(63),
    qualifications TEXT,
    visit_charge NUMERIC(10,2),
    branch_name VARCHAR(63),
    profile_url VARCHAR(255)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.emp_id AS doctor_id,
        e.emp_name AS doctor_name,
        dept.department_name,
        d.qualifications,
        d.visit_charge,
        b.branch_name,
        d.profile_url
    FROM doctor d
    JOIN employee e ON e.emp_id = d.emp_id
    JOIN department dept ON dept.department_id = d.department_id
    JOIN branch b ON b.branch_id = e.branch_id
    WHERE e.emp_type = 'doctor'
    ORDER BY dept.department_name, e.emp_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Get Doctor Details with Schedule Information
-- ============================================================================
CREATE OR REPLACE FUNCTION get_doctor_details_with_schedule(
    p_doctor_id INTEGER
)
RETURNS TABLE (
    doctor_id INTEGER,
    doctor_name VARCHAR(63),
    department_name VARCHAR(63),
    qualifications TEXT,
    visit_charge NUMERIC(10,2),
    branch_name VARCHAR(63),
    profile_url VARCHAR(255),
    emp_phone VARCHAR(14),
    emp_email VARCHAR(255),
    experience TEXT,
    schedule_no INTEGER,
    start_time TIME,
    finish_time TIME,
    week_day INTEGER,
    schedule_branch_id INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.emp_id AS doctor_id,
        e.emp_name AS doctor_name,
        dept.department_name,
        d.qualifications,
        d.visit_charge,
        b.branch_name,
        d.profile_url,
        e.emp_phone,
        e.emp_email,
        e.experience,
        ds.schedule_no,
        ds.start_time,
        ds.finish_time,
        ds.week_day,
        ds.branch_id as schedule_branch_id
    FROM doctor d
    JOIN employee e ON e.emp_id = d.emp_id
    JOIN department dept ON dept.department_id = d.department_id
    JOIN branch b ON b.branch_id = e.branch_id
    LEFT JOIN doctor_schedule ds ON ds.doctor_id = d.emp_id
    WHERE d.emp_id = p_doctor_id AND e.emp_type = 'doctor'
    ORDER BY ds.week_day, ds.start_time;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Get Available Time Slots for a Doctor on a Specific Date
-- ============================================================================
CREATE OR REPLACE FUNCTION get_available_time_slots(
    p_doctor_id INTEGER,
    p_visit_date DATE
)
RETURNS TABLE (
    schedule_no INTEGER,
    start_time TIME,
    finish_time TIME,
    week_day INTEGER,
    branch_id INTEGER,
    branch_name VARCHAR(63),
    is_available BOOLEAN,
    existing_appointments INTEGER
) AS $$
DECLARE
    v_week_day INTEGER;
BEGIN
    -- Get the day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
    v_week_day := EXTRACT(DOW FROM p_visit_date);
    
    RETURN QUERY
    SELECT 
        ds.schedule_no,
        ds.start_time,
        ds.finish_time,
        ds.week_day,
        ds.branch_id,
        b.branch_name,
        TRUE as is_available,  -- All existing schedules are available
        COUNT(a.appointment_id) as existing_appointments
    FROM doctor_schedule ds
    JOIN branch b ON b.branch_id = ds.branch_id
    LEFT JOIN appointment a ON a.doctor_id = ds.doctor_id 
                           AND a.visit_date = p_visit_date 
                           AND a.schedule_no = ds.schedule_no
                           AND a.status NOT IN ('cancelled')
    WHERE ds.doctor_id = p_doctor_id 
      AND ds.week_day = v_week_day
    GROUP BY ds.schedule_no, ds.start_time, ds.finish_time, ds.week_day, 
             ds.branch_id, b.branch_name
    ORDER BY ds.start_time;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Get Next Available Serial Number for a Doctor on a Date
-- ============================================================================
CREATE OR REPLACE FUNCTION get_next_serial_number(
    p_doctor_id INTEGER,
    p_visit_date DATE
)
RETURNS INTEGER AS $$
DECLARE
    v_max_serial INTEGER;
BEGIN
    SELECT COALESCE(MAX(serial_no), 0) INTO v_max_serial
    FROM appointment
    WHERE doctor_id = p_doctor_id 
      AND visit_date = p_visit_date
      AND status NOT IN ('cancelled');
    
    RETURN v_max_serial + 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Create Appointment Request
-- ============================================================================
CREATE OR REPLACE FUNCTION create_appointment_request(
    p_patient_id INTEGER,
    p_doctor_id INTEGER,
    p_visit_date DATE,
    p_schedule_no INTEGER,
    p_creation_method VARCHAR(20) DEFAULT 'online',
    p_created_by INTEGER DEFAULT NULL
)
RETURNS TABLE (
    appointment_id INTEGER,
    serial_no INTEGER,
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_serial_no INTEGER;
    v_appointment_id INTEGER;
    v_patient_exists BOOLEAN;
    v_doctor_exists BOOLEAN;
    v_schedule_exists BOOLEAN;
    v_week_day INTEGER;
BEGIN
    -- Get the day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
    v_week_day := EXTRACT(DOW FROM p_visit_date);
    
    -- Validate patient exists
    SELECT EXISTS(
        SELECT 1 FROM patient 
        WHERE patient_id = p_patient_id
    ) INTO v_patient_exists;
    
    IF NOT v_patient_exists THEN
        RETURN QUERY SELECT 
            NULL::INTEGER as appointment_id,
            NULL::INTEGER as serial_no,
            FALSE as success,
            'Patient not found' as message;
        RETURN;
    END IF;
    
    -- Validate doctor exists
    SELECT EXISTS(
        SELECT 1 FROM doctor d
        JOIN employee e ON e.emp_id = d.emp_id
        WHERE d.emp_id = p_doctor_id AND e.emp_type = 'doctor'
    ) INTO v_doctor_exists;
    
    IF NOT v_doctor_exists THEN
        RETURN QUERY SELECT 
            NULL::INTEGER as appointment_id,
            NULL::INTEGER as serial_no,
            FALSE as success,
            'Doctor not found' as message;
        RETURN;
    END IF;
    
    -- Validate visit date is not in the past
    IF p_visit_date < CURRENT_DATE THEN
        RETURN QUERY SELECT 
            NULL::INTEGER as appointment_id,
            NULL::INTEGER as serial_no,
            FALSE as success,
            'Cannot book appointments in the past' as message;
        RETURN;
    END IF;
    
    -- Validate schedule exists for the doctor on that day
    SELECT EXISTS(
        SELECT 1 FROM doctor_schedule
        WHERE doctor_id = p_doctor_id 
          AND schedule_no = p_schedule_no
          AND week_day = v_week_day
    ) INTO v_schedule_exists;
    
    IF NOT v_schedule_exists THEN
        RETURN QUERY SELECT 
            NULL::INTEGER as appointment_id,
            NULL::INTEGER as serial_no,
            FALSE as success,
            'Selected time slot is not available for this doctor' as message;
        RETURN;
    END IF;
    
    -- Get next serial number
    SELECT get_next_serial_number(p_doctor_id, p_visit_date) INTO v_serial_no;
    
    -- Create the appointment
    INSERT INTO appointment (
        patient_id,
        doctor_id,
        visit_date,
        schedule_no,
        serial_no,
        status,
        creation_method,
        created_by,
        created_at
    ) VALUES (
        p_patient_id,
        p_doctor_id,
        p_visit_date,
        p_schedule_no,
        v_serial_no,
        'scheduled',
        p_creation_method,
        p_created_by,
        CURRENT_TIMESTAMP
    ) RETURNING appointment_id INTO v_appointment_id;
    
    -- Return success
    RETURN QUERY SELECT 
        v_appointment_id as appointment_id,
        v_serial_no as serial_no,
        TRUE as success,
        'Appointment created successfully' as message;
        
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check that all functions were created successfully
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'get_all_doctors',
    'get_doctor_details_with_schedule',
    'get_available_time_slots',
    'get_next_serial_number',
    'create_appointment_request'
)
AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

-- Example 1: Get all doctors for selection
-- SELECT * FROM get_all_doctors();

-- Example 2: Get specific doctor details with schedule
-- SELECT * FROM get_doctor_details_with_schedule(1);

-- Example 3: Get available time slots for a doctor on a specific date
-- SELECT * FROM get_available_time_slots(1, '2025-01-15');

-- Example 4: Get next serial number for a doctor on a date
-- SELECT get_next_serial_number(1, '2025-01-15');

-- Example 5: Create an appointment request
-- SELECT * FROM create_appointment_request(1, 1, '2025-01-20', 1);

-- ============================================================================
-- SUGGESTED FUNCTIONS FOR APPOINTMENT CREATION
-- ============================================================================

/*
Based on the appointment table structure and the functions above, 
here are the suggested functions needed for creating appointments:

1. **create_appointment_request** (Main function)
   - Input: patient_id, doctor_id, visit_date, schedule_no, creation_method, created_by
   - Output: appointment_id, serial_no, success status
   - Logic: 
     * Validate doctor exists and is active
     * Check if time slot is available
     * Generate next serial number
     * Create appointment with 'scheduled' status
     * Return appointment details

2. **validate_appointment_request** (Validation function)
   - Input: patient_id, doctor_id, visit_date, schedule_no
   - Output: validation_result (boolean), error_message (text)
   - Logic:
     * Check if patient exists and is active
     * Check if doctor exists and is active
     * Check if visit_date is valid (not in past, within reasonable future)
     * Check if schedule_no exists for that doctor on that day
     * Check if time slot is available
     * Return validation result

3. **get_appointment_creation_summary** (Summary function)
   - Input: appointment_id
   - Output: appointment details, doctor info, patient info, cost
   - Logic:
     * Get complete appointment information
     * Include doctor details and visit charge
     * Include patient information
     * Calculate total cost
     * Return summary for confirmation

4. **cancel_appointment_request** (Cancellation function)
   - Input: appointment_id, patient_id (for verification)
   - Output: success status, message
   - Logic:
     * Verify appointment belongs to patient
     * Check if appointment can be cancelled (not completed/visited)
     * Update status to 'cancelled'
     * Return success/failure

5. **get_patient_appointment_requests** (List function)
   - Input: patient_id
   - Output: list of pending/scheduled appointments
   - Logic:
     * Get all appointments for patient with 'scheduled' status
     * Include doctor and schedule information
     * Order by visit_date and schedule_no

These functions would provide a complete workflow for:
- Browsing available doctors
- Selecting a doctor and viewing their schedule
- Checking availability for specific dates/times
- Creating appointment requests
- Managing existing requests
- Cancelling appointments when needed
*/ 