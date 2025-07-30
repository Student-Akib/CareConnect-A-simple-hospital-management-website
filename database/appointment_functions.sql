-- ============================================================================
-- APPOINTMENT MANAGEMENT FUNCTIONS
-- ============================================================================

-- ============================================================================
-- FUNCTION: Get All Appointments for Patient
-- ============================================================================
CREATE OR REPLACE FUNCTION get_patient_appointments(
    p_patient_id INTEGER
)
RETURNS TABLE (
    appointment_id INTEGER,
    visit_date DATE,
    schedule_no INTEGER,
    serial_no INTEGER,
    status appointment_status,
    created_at TIMESTAMP,
    creation_method creation_method,
    bill_id INTEGER,
    doctor_name VARCHAR(63),
    specialization TEXT,
    prescription_id INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.appointment_id,
        a.visit_date,
        a.schedule_no,
        a.serial_no,
        a.status,
        a.created_at,
        a.creation_method,
        a.bill_id,
        e.emp_name AS doctor_name,
        d.qualifications AS specialization,
        p.prescription_id
    FROM appointment a
    JOIN doctor d ON d.emp_id = a.doctor_id
    JOIN employee e ON e.emp_id = d.emp_id
    LEFT JOIN prescription p ON p.appointment_id = a.appointment_id
    WHERE a.patient_id = p_patient_id
    ORDER BY a.visit_date DESC, a.schedule_no ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Get Detailed Appointment Information
-- ============================================================================
CREATE OR REPLACE FUNCTION get_appointment_details(
    p_appointment_id INTEGER,
    p_patient_id INTEGER
)
RETURNS TABLE (
    appointment_id INTEGER,
    visit_date DATE,
    schedule_no INTEGER,
    serial_no INTEGER,
    status appointment_status,
    created_at TIMESTAMP,
    creation_method creation_method,
    doctor_name VARCHAR(63),
    specialization TEXT,
    doctor_phone VARCHAR(14),
    bill_id INTEGER,
    total_amount NUMERIC(12,2),
    payment_status payment_method
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.appointment_id,
        a.visit_date,
        a.schedule_no,
        a.serial_no,
        a.status,
        a.created_at,
        a.creation_method,
        e.emp_name AS doctor_name,
        d.qualifications AS specialization,
        e.emp_phone AS doctor_phone,
        b.bill_id,
        b.final_amount AS total_amount,
        b.payment_method AS payment_status
    FROM appointment a
    JOIN doctor d ON d.emp_id = a.doctor_id
    JOIN employee e ON e.emp_id = d.emp_id
    LEFT JOIN bill b ON b.bill_id = a.bill_id
    WHERE a.appointment_id = p_appointment_id 
      AND a.patient_id = p_patient_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Get Prescription Details
-- ============================================================================
CREATE OR REPLACE FUNCTION get_prescription_details(
    p_prescription_id INTEGER
)
RETURNS TABLE (
    prescription_id INTEGER,
    diagnosis TEXT,
    suggested_tests TEXT,
    next_visit_date DATE,
    doctor_notes TEXT,
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.prescription_id,
        p.diagnosis,
        p.suggested_tests,
        p.next_visit_date,
        p.doctor_notes,
        p.created_at
    FROM prescription p
    WHERE p.prescription_id = p_prescription_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Get Prescription Items (Medications)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_prescription_items(
    p_prescription_id INTEGER
)
RETURNS TABLE (
    drug_id INTEGER,
    drug_name VARCHAR(127),
    dosage VARCHAR(63),
    frequency VARCHAR(63),
    duration VARCHAR(63),
    notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pi.drug_id,
        d.drug_name,
        pi.dosage,
        pi.frequency,
        pi.duration,
        pi.notes
    FROM prescription_item pi
    JOIN drug d ON d.drug_id = pi.drug_id
    WHERE pi.prescription_id = p_prescription_id
    ORDER BY d.drug_name;
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
    'get_patient_appointments',
    'get_appointment_details',
    'get_prescription_details',
    'get_prescription_items'
)
AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

-- Example 1: Get all appointments for a patient
-- SELECT * FROM get_patient_appointments(1);

-- Example 2: Get appointment details
-- SELECT * FROM get_appointment_details(1, 1);

-- Example 3: Get prescription details
-- SELECT * FROM get_prescription_details(1);

-- Example 4: Get prescription medications
-- SELECT * FROM get_prescription_items(1); 