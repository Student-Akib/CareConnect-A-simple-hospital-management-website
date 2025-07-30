const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');

// /me and /notifications endpoints (protected)
router.get('/me', authController.authenticateToken, userController.getMe);
router.get('/notifications', authController.authenticateToken, userController.getNotifications);

// Update and delete user (protected, for current user)
router.put('/me', authController.authenticateToken, userController.updateProfile);
router.delete('/me', authController.authenticateToken, userController.deleteUser);

module.exports = router; 