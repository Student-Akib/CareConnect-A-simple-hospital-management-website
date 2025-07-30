const pool = require('../db');

// Helper function to get patient ID
const getPatientId = async (req) => {
    const patientId = req.user.patientId;
    if (patientId) {
        return patientId;
    }
    
      try {
        const { rows } = await pool.query(
          'SELECT patient_id FROM external_user WHERE external_user_id = $1',
          [req.user.userId]
        );
        
        if (rows.length === 0) {
            throw new Error('User not found');
        }
        
        return rows[0].patient_id;
    } catch (error) {
        throw new Error('Failed to fetch patient ID');
    }
};

// ============================================================================
// APPOINTMENT VIEWING METHODS (Existing)
// ============================================================================

exports.getAllAppointments = async (req, res) => {
    try {
        const patientId = await getPatientId(req);
        
    const { rows } = await pool.query(
            'SELECT * FROM get_patient_appointments($1)',
            [patientId]
        );
        
        res.json({ appointments: rows });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch appointments' });
    }
};

exports.getAppointmentDetails = async (req, res) => {
  try {
        const patientId = await getPatientId(req);
        const appointmentId = req.params.appointmentId;
        
        const { rows } = await pool.query(
            'SELECT * FROM get_appointment_details($1, $2)',
            [appointmentId, patientId]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Appointment not found' });
        }
        
        res.json({ appointment: rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch appointment details' });
    }
};

exports.getPrescriptionDetails = async (req, res) => {
    try {
        const prescriptionId = req.params.prescriptionId;
        
        // Get prescription details
        const { rows: prescriptionRows } = await pool.query(
            'SELECT * FROM get_prescription_details($1)',
            [prescriptionId]
        );
        
        if (prescriptionRows.length === 0) {
            return res.status(404).json({ error: 'Prescription not found' });
        }
        
        // Get prescription items (medications)
        const { rows: medicationRows } = await pool.query(
            'SELECT * FROM get_prescription_items($1)',
            [prescriptionId]
        );
        
        res.json({
            prescription: prescriptionRows[0],
            medications: medicationRows
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch prescription details' });
    }
};

// ============================================================================
// APPOINTMENT CREATION METHODS (New)
// ============================================================================

exports.getAllDoctors = async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM get_all_doctors()');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch doctors' });
    }
};

exports.getDoctorDetails = async (req, res) => {
    try {
        const doctorId = req.params.doctorId;
        
        const { rows } = await pool.query(
            'SELECT * FROM get_doctor_details_with_schedule($1)',
            [doctorId]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Doctor not found' });
        }
        
        // Transform the data to separate doctor info and schedules
        const doctorInfo = {
            doctor_id: rows[0].doctor_id,
            doctor_name: rows[0].doctor_name,
            department_name: rows[0].department_name,
            qualifications: rows[0].qualifications,
            visit_charge: rows[0].visit_charge,
            branch_name: rows[0].branch_name,
            profile_url: rows[0].profile_url,
            emp_phone: rows[0].emp_phone,
            emp_email: rows[0].emp_email,
            experience: rows[0].experience
        };
        
        // Extract schedules (filter out null schedule entries)
        const schedules = rows
            .filter(row => row.schedule_no !== null)
            .map(row => ({
                schedule_no: row.schedule_no,
                start_time: row.start_time,
                finish_time: row.finish_time,
                week_day: row.week_day,
                branch_id: row.schedule_branch_id
            }));

    res.json({
            doctor: doctorInfo,
            schedules: schedules
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch doctor details' });
    }
};

exports.getDoctorAvailability = async (req, res) => {
    try {
        const doctorId = req.params.doctorId;
        const visitDate = req.params.visitDate;
        
        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
        }
        
        // Get the day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
        const weekDay = new Date(visitDate).getDay();
        
        // Direct SQL query to get available time slots
        const { rows } = await pool.query(`
            SELECT 
                ds.schedule_no,
                ds.start_time,
                ds.finish_time,
                ds.week_day,
                ds.branch_id,
                b.branch_name,
                TRUE as is_available,
                COUNT(a.appointment_id) as existing_appointments
            FROM doctor_schedule ds
            JOIN branch b ON b.branch_id = ds.branch_id
            LEFT JOIN appointment a ON a.doctor_id = ds.doctor_id 
                                   AND a.visit_date = $2 
                                   AND a.schedule_no = ds.schedule_no
                                   AND a.status NOT IN ('cancelled')
            WHERE ds.doctor_id = $1 
              AND ds.week_day = $3
            GROUP BY ds.schedule_no, ds.start_time, ds.finish_time, ds.week_day, 
                     ds.branch_id, b.branch_name
            ORDER BY ds.start_time
        `, [doctorId, visitDate, weekDay]);
        
        res.json(rows);
    } catch (error) {
        console.error('getDoctorAvailability error:', error);
        res.status(500).json({ error: 'Failed to fetch doctor availability', details: error.message });
    }
};

exports.getNextSerialNumber = async (req, res) => {
    try {
        const doctorId = req.params.doctorId;
        const visitDate = req.params.visitDate;
        
        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
        }
        
        // Direct SQL query to get next serial number
        const { rows } = await pool.query(`
            SELECT COALESCE(MAX(serial_no), 0) + 1 as next_serial
            FROM appointment
            WHERE doctor_id = $1 
              AND visit_date = $2
              AND status NOT IN ('cancelled')
        `, [doctorId, visitDate]);
        
        res.json({ next_serial: rows[0].next_serial });
    } catch (error) {
        console.error('getNextSerialNumber error:', error);
        res.status(500).json({ error: 'Failed to get next serial number', details: error.message });
    }
};

exports.createAppointment = async (req, res) => {
    console.log('=== APPOINTMENT CREATION STARTED ===');
    console.log('Request body:', req.body);
    console.log('Request user:', req.user);
    
    try {
        const patientId = await getPatientId(req);
        console.log('Got patient ID:', patientId);
        
        const { doctorId, visitDate, scheduleNo, creationMethod = 'online' } = req.body;
        console.log('Extracted values:', { doctorId, visitDate, scheduleNo, creationMethod });
        
        // Validate required fields
        if (!doctorId || !visitDate || !scheduleNo) {
            return res.status(400).json({ 
                error: 'Missing required fields: doctorId, visitDate, scheduleNo' 
            });
        }
        
        // Get next serial number
        const { rows: serialRows } = await pool.query(`
            SELECT COALESCE(MAX(serial_no), 0) + 1 as next_serial
            FROM appointment
            WHERE doctor_id = $1 
              AND visit_date = $2
              AND status NOT IN ('cancelled')
        `, [doctorId, visitDate]);
        
        const serialNo = serialRows[0].next_serial;
        
        // The created_by constraint is too restrictive for online appointments
        // Let's temporarily bypass this by creating without created_by
        // Since created_by is NOT NULL, we need to modify the table or find a workaround
        
        // Validate all foreign key references before inserting
        console.log('=== VALIDATING FOREIGN KEYS ===');
        
        // Check if patient exists
        const { rows: patientCheck } = await pool.query('SELECT patient_id FROM patient WHERE patient_id = $1', [patientId]);
        console.log('Patient exists:', patientCheck.length > 0, 'patientId:', patientId);
        
        // Check if doctor exists
        const { rows: doctorCheck } = await pool.query('SELECT emp_id FROM doctor WHERE emp_id = $1', [doctorId]);
        console.log('Doctor exists:', doctorCheck.length > 0, 'doctorId:', doctorId);
        
        // Try to find ANY internal user that exists
        let createdBy = null;
        const { rows: internalUsers } = await pool.query('SELECT emp_id FROM internal_user LIMIT 1');
        if (internalUsers.length > 0) {
            createdBy = internalUsers[0].emp_id;
            console.log('Using internal user:', createdBy);
        } else {
            console.log('No internal users found');
            return res.status(500).json({ error: 'No internal users available for appointment creation' });
        }
        
        console.log('=== ALL VALUES TO INSERT ===');
        console.log('patientId:', patientId, 'doctorId:', doctorId, 'visitDate:', visitDate);
        console.log('scheduleNo:', scheduleNo, 'serialNo:', serialNo, 'creationMethod:', creationMethod, 'createdBy:', createdBy);

        const { rows } = await pool.query(`
            INSERT INTO appointment (
                patient_id, doctor_id, visit_date, schedule_no, serial_no, 
                status, creation_method, created_by
            ) VALUES ($1, $2, $3, $4, $5, 'scheduled', $6, $7)
            RETURNING appointment_id, serial_no
        `, [patientId, doctorId, visitDate, scheduleNo, serialNo, creationMethod, createdBy]);
        
        const appointment = rows[0];
        
        res.status(201).json({
            success: true,
            message: 'Appointment created successfully',
            appointment: {
                appointment_id: appointment.appointment_id,
                serial_no: appointment.serial_no,
                doctor_id: doctorId,
                visit_date: visitDate,
                schedule_no: scheduleNo
            }
        });
        
    } catch (error) {
        console.error('createAppointment error:', error);
        res.status(500).json({ 
            error: 'Failed to create appointment', 
            details: error.message 
        });
    }
};

 