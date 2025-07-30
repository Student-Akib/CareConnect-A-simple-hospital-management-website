const pool = require('../db');

// Get all appointments for a user
exports.getAllAppointments = async (req, res) => {
  try {
    const patientId = req.user.patientId;
    
    console.log('Fetching appointments for patient:', patientId);
    console.log('User info from JWT:', req.user);
    
    // Check if patientId exists in JWT token, if not, get it from database
    let finalPatientId = patientId;
    if (!patientId) {
      console.log('No patientId in JWT token, fetching from database for user:', req.user.userId);
      try {
        const { rows } = await pool.query(
          'SELECT patient_id FROM external_user WHERE external_user_id = $1',
          [req.user.userId]
        );
        
        if (rows.length === 0) {
          console.error('User not found in database');
          return res.status(401).json({ error: 'User not found. Please log in again.' });
        }
        
        finalPatientId = rows[0].patient_id;
        console.log('Retrieved patientId from database:', finalPatientId);
      } catch (dbError) {
        console.error('Database error while fetching patientId:', dbError);
        return res.status(500).json({ error: 'Server error while fetching user data.' });
      }
    }
    
    console.log('Final patientId being used for query:', finalPatientId);
    
    // Debug: Check all appointments in database to see if there are any
    try {
      const allAppts = await pool.query('SELECT COUNT(*) as total, array_agg(DISTINCT patient_id) as patient_ids FROM appointment');
      console.log('Total appointments in database:', allAppts.rows[0].total);
      console.log('Patient IDs with appointments:', allAppts.rows[0].patient_ids);
    } catch (debugErr) {
      console.log('Debug query failed:', debugErr.message);
    }

    // Get all appointments for the patient (without prescription join to avoid duplicates)
    const { rows } = await pool.query(
      `SELECT 
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
        CASE WHEN EXISTS (
          SELECT 1 FROM prescription p WHERE p.appointment_id = a.appointment_id
        ) THEN (
          SELECT p.prescription_id FROM prescription p WHERE p.appointment_id = a.appointment_id LIMIT 1
        ) ELSE NULL END AS prescription_id
      FROM appointment a
      JOIN doctor d ON d.emp_id = a.doctor_id
      JOIN employee e ON e.emp_id = d.emp_id
      WHERE a.patient_id = $1
      ORDER BY a.visit_date DESC, a.schedule_no ASC`,
      [finalPatientId]
    );

    console.log(`Found ${rows.length} appointments for patient ${finalPatientId}`);
    console.log('Appointment IDs:', rows.map(r => r.appointment_id));
    console.log('User details - userId:', req.user.userId, ', patientId from token:', req.user.patientId, ', final patientId used:', finalPatientId);

    res.json({
      appointments: rows,
      totalAppointments: rows.length
    });

  } catch (err) {
    console.error('getAllAppointments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get detailed appointment information
exports.getAppointmentDetails = async (req, res) => {
  try {
    const patientId = req.user.patientId;
    const { appointmentId } = req.params;
    
    console.log('Fetching appointment details:', { 
      patientId, 
      appointmentId,
      user: req.user,
      hasPatientId: !!req.user.patientId 
    });
    
    // Check if patientId exists in JWT token, if not, get it from database
    let finalPatientId = patientId;
    if (!patientId) {
      console.log('No patientId in JWT token, fetching from database for user:', req.user.userId);
      try {
        const { rows } = await pool.query(
          'SELECT patient_id FROM external_user WHERE external_user_id = $1',
          [req.user.userId]
        );
        
        if (rows.length === 0) {
          console.error('User not found in database');
          return res.status(401).json({ error: 'User not found. Please log in again.' });
        }
        
        finalPatientId = rows[0].patient_id;
        console.log('Retrieved patientId from database:', finalPatientId);
      } catch (dbError) {
        console.error('Database error while fetching patientId:', dbError);
        return res.status(500).json({ error: 'Server error while fetching user data.' });
      }
    }
    
    // Get appointment details
    const { rows: appointments } = await pool.query(
      `SELECT 
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
      WHERE a.appointment_id = $1 AND a.patient_id = $2`,
      [appointmentId, finalPatientId]
    );

    if (appointments.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const appointment = appointments[0];

    // Get prescription details if available
    let prescription = null;
    if (appointment.prescription_id) {
      const { rows: prescriptions } = await pool.query(
        `SELECT 
          p.prescription_id,
          p.diagnosis,
          p.next_visit_date,
          p.created_at
        FROM prescription p
        WHERE p.prescription_id = $1`,
        [appointment.prescription_id]
      );

      if (prescriptions.length > 0) {
        prescription = prescriptions[0];

        // Get prescription items
        const { rows: prescriptionItems } = await pool.query(
          `SELECT 
            pi.prescription_item_id,
            pi.dosage,
            pi.duration,
            pi.instructions,
            d.drug_name
          FROM prescription_item pi
          JOIN drug d ON d.drug_id = pi.drug_id
          WHERE pi.prescription_id = $1`,
          [prescription.prescription_id]
        );

        prescription.items = prescriptionItems;
      }
    }

    console.log('Appointment details retrieved successfully');

    res.json({
      appointment,
      prescription
    });

  } catch (err) {
    console.error('getAppointmentDetails error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Request appointment
exports.requestAppointment = async (req, res) => {
  try {
    const patientId = req.user.patientId;
    const userId = req.user.userId;
    const { doctorId, visitDate, scheduleNo, reason } = req.body;
    
    // Get patient_id if not in JWT
    let finalPatientId = patientId;
    if (!finalPatientId) {
      const userResult = await pool.query(
        'SELECT patient_id FROM external_user WHERE external_user_id = $1',
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      finalPatientId = userResult.rows[0].patient_id;
    }
    
    // Check if the doctor schedule exists
    const scheduleCheck = await pool.query(`
      SELECT * FROM doctor_schedule 
      WHERE doctor_id = $1 AND schedule_no = $2
    `, [doctorId, scheduleNo]);
    
    if (scheduleCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid schedule selected' });
    }
    
    // Check for existing appointments on the same date and schedule
    const conflictCheck = await pool.query(`
      SELECT COUNT(*) as count 
      FROM appointment 
      WHERE doctor_id = $1 
        AND visit_date = $2 
        AND schedule_no = $3 
        AND status NOT IN ('cancelled')
    `, [doctorId, visitDate, scheduleNo]);
    
    const appointmentCount = parseInt(conflictCheck.rows[0].count);
    
    // Get next serial number
    const serialNo = appointmentCount + 1;
    
    // Create appointment with 'requested' status
    const { rows } = await pool.query(`
      INSERT INTO appointment (
        patient_id, doctor_id, visit_date, schedule_no, 
        serial_no, status, created_by, creation_method
      ) VALUES ($1, $2, $3, $4, $5, 'requested', $6, 'online')
      RETURNING appointment_id
    `, [finalPatientId, doctorId, visitDate, scheduleNo, serialNo, userId]);
    
    const appointmentId = rows[0].appointment_id;
    
    // Create notification for the patient
    await pool.query(`
      INSERT INTO notification (
        external_user_id, title, text, type, status, related_id
      ) VALUES (
        $1, 
        'Appointment Request Submitted',
        'Your appointment request has been submitted. You will be notified once it is confirmed by the receptionist.',
        'appointment',
        'unread',
        $2
      )
    `, [userId, appointmentId]);
    
    res.status(201).json({
      message: 'Appointment request submitted successfully',
      appointmentId: appointmentId
    });
    
  } catch (err) {
    console.error('Error creating appointment request:', err);
    res.status(500).json({ error: 'Failed to create appointment request' });
  }
}; 