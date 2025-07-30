const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { authenticateToken } = require('../controllers/authController');

// ============================================================================
// APPOINTMENT VIEWING ROUTES (Existing)
// ============================================================================

// Get all appointments for the authenticated user
router.get('/', authenticateToken, appointmentController.getAllAppointments);

// Get prescription details separately (Moved above :appointmentId)
router.get('/prescription/:prescriptionId', authenticateToken, appointmentController.getPrescriptionDetails);

// Get detailed appointment information (without prescription)
router.get('/:appointmentId', authenticateToken, appointmentController.getAppointmentDetails);

// ============================================================================
// APPOINTMENT CREATION ROUTES (New)
// ============================================================================

// Get all doctors for selection
router.get('/doctors/all', authenticateToken, appointmentController.getAllDoctors);

// Get specific doctor details with schedule
router.get('/doctors/:doctorId', authenticateToken, appointmentController.getDoctorDetails);

// Get available time slots for a doctor on a specific date
router.get('/doctors/:doctorId/availability/:visitDate', authenticateToken, appointmentController.getDoctorAvailability);

// Get next serial number for a doctor on a date
router.get('/doctors/:doctorId/serial/:visitDate', authenticateToken, appointmentController.getNextSerialNumber);

// Create new appointment
router.post('/create', authenticateToken, appointmentController.createAppointment);

module.exports = router; 