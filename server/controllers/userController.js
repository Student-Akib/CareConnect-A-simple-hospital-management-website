const pool = require('../db');
require('dotenv').config();

// Get all users (admin only, for demo)
exports.getAllUsers = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT external_user_id, external_username, external_user_email, patient_id, created_at FROM external_user`
    );
    res.json(rows);
  } catch (err) {
    console.error('getAllUsers error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update user profile (calls update_patient_profile)
exports.updateProfile = async (req, res) => {
  try {
    const extUserId = req.user.userId;
    const { name, phone, dob, sex, bloodType } = req.body;
    const { rows } = await pool.query(
      `SELECT update_patient_profile($1, $2, $3, $4, $5, $6) AS updated`,
      [
        extUserId,
        name || null,
        phone || null,
        dob || null,
        sex || null,
        bloodType || null
      ]
    );
    if (rows[0].updated) {
      res.json({ message: 'Profile updated' });
    } else {
      res.status(400).json({ error: 'Update failed' });
    }
  } catch (err) {
    if (err.code === 'P0001') {
      return res.status(400).json({ error: err.message });
    }
    console.error('updateProfile error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete user (and cascade patient_access, notifications)
exports.deleteUser = async (req, res) => {
  try {
    const extUserId = req.user.userId;
    await pool.query(`DELETE FROM external_user WHERE external_user_id = $1`, [extUserId]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('deleteUser error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get current user info (with patient details)
exports.getMe = async (req, res) => {
  try {
    const extUserId = req.user.userId;
    const { rows } = await pool.query(
      `SELECT 
        eu.external_user_id AS id,
        eu.external_username AS username,
        eu.external_user_email AS email,
        eu.patient_id,
        p.patient_name AS name,
        p.patient_phone AS phone,
        p.patient_dob AS dob,
        p.patient_sex AS sex,
        p.patient_blood_type AS bloodType
      FROM external_user eu
      JOIN patient p ON p.patient_id = eu.patient_id
      WHERE eu.external_user_id = $1`,
      [extUserId]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const u = rows[0];
    res.json({
      id: u.id,
      username: u.username,
      email: u.email,
      patient: {
        id: u.patient_id,
        name: u.name,
        phone: u.phone,
        dob: u.dob,
        sex: u.sex,
        bloodType: u.bloodtype
      }
    });
  } catch (err) {
    console.error('getMe error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get notifications for current user
exports.getNotifications = async (req, res) => {
  try {
    const extUserId = req.user.userId;
    const { rows } = await pool.query(
      `SELECT
         notification_id AS id,
         notification_type AS type,
         title,
         message,
         status,
         created_at AS time
       FROM notification
       WHERE external_user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [extUserId]
    );
    const unreadCount = rows.filter(n => n.status === 'unread').length;
    res.json({ unreadCount, notifications: rows });
  } catch (err) {
    console.error('getNotifications error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Dashboard endpoint (protected)
exports.getDashboard = (req, res) => {
  res.json({
    message: `Welcome to your dashboard, ${req.user.username}!`,
    user: req.user
  });
};