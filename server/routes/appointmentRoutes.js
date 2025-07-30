const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { authenticateToken } = require('../controllers/authController');

// Get all appointments for the authenticated user
router.get('/', authenticateToken, appointmentController.getAllAppointments);

// Get detailed appointment information
router.get('/:appointmentId', authenticateToken, appointmentController.getAppointmentDetails);

// Appointment request route
router.post('/request', authenticateToken, appointmentController.requestAppointment);

module.exports = router; 