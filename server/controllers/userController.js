const pool = require('../db');
require('dotenv').config();


// Update user profile (calls update_patient_profile)
exports.updateProfile = async (req, res) => {
  try {
    const extUserId = req.user.userId;
    const { name, phone, dob, sex, bloodType } = req.body;
    
    // Input sanitization
    const sanitizedName = name ? name.trim() : null;
    const sanitizedPhone = phone ? phone.trim() : null;
    const sanitizedDob = dob ? dob.trim() : null;
    const sanitizedSex = sex ? sex.trim() : null;
    const sanitizedBloodType = bloodType ? bloodType.trim() : null;
    
    console.log('Profile update request for user:', extUserId);

    const { rows } = await pool.query(
      `SELECT update_external_user_profile($1, $2, $3, $4, $5, $6) AS updated`,
      [
        extUserId,
        sanitizedName,
        sanitizedPhone,
        sanitizedDob,
        sanitizedSex,
        sanitizedBloodType
      ]
    );
    
    if (rows[0].updated) {
      res.json({ message: 'Profile updated' });
    } else {
      res.status(400).json({ error: 'Update failed' });
    }
  } catch (err) {
    if (err.code === 'P0001') {
      console.error('Database function error:', err.message);
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
    
    console.log('User deletion request for user:', extUserId);
    
    const { rows } = await pool.query(
      `SELECT delete_external_user($1) AS deleted`,
      [extUserId]
    );
    
    if (rows[0].deleted) {
      res.json({ message: 'User and all related data deleted successfully' });
    } else {
      res.status(400).json({ error: 'Delete failed' });
    }
  } catch (err) {
    if (err.code === 'P0001') {
      console.error('Database function error during deletion:', err.message);
      return res.status(400).json({ error: err.message });
    }
    console.error('deleteUser error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get current user info (with patient details)
exports.getMe = async (req, res) => {
  try {
    const extUserId = req.user.userId;
    
    console.log('Fetching user profile for user:', extUserId);
    
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
        p.patient_blood_type AS "bloodType"
      FROM external_user eu
      JOIN patient p ON p.patient_id = eu.patient_id
      WHERE eu.external_user_id = $1`,
      [extUserId]
    );
    
    if (!rows.length) {
      console.log('User not found:', extUserId);
      return res.status(404).json({ error: 'User not found' });
    }
    
    const u = rows[0];
    console.log('User profile fetched successfully:', {
      userId: u.id,
      username: u.username,
      patientId: u.patient_id,
      bloodType: u.bloodType,
      sex: u.sex
    });
    
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
        bloodType: u.bloodType ? u.bloodType.trim() : null
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
    
    console.log('Fetching notifications for user:', extUserId);
    
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
    console.log('Notifications fetched:', {
      userId: extUserId,
      totalNotifications: rows.length,
      unreadCount: unreadCount
    });
    
    res.json({ unreadCount, notifications: rows });
  } catch (err) {
    console.error('getNotifications error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

