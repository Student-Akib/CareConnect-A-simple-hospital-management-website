const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const saltRounds = 10;
// const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_that_should_be_in_an_env_file';
const JWT_SECRET = process.env.JWT_SECRET;

exports.register = async (req, res) => {
  const { username, email, password, phone, name, dob, sex, bloodType } = req.body;
  
  // Input sanitization
  const sanitizedUsername = username ? username.trim() : '';
  const sanitizedEmail = email ? email.trim().toLowerCase() : '';
  const sanitizedPassword = password ? password.trim() : '';
  const sanitizedPhone = phone ? phone.trim() : '';
  const sanitizedName = name ? name.trim() : '';
  
  // Validate required fields
  if (!sanitizedUsername || !sanitizedEmail || !sanitizedPassword) {
    return res.status(400).json({ 
      error: 'Username, email, and password are required.' 
    });
  }
  
  // Additional validation
  if (sanitizedUsername.length === 0 || sanitizedEmail.length === 0 || sanitizedPassword.length === 0) {
    return res.status(400).json({ 
      error: 'Username, email, and password cannot be empty.' 
    });
  }
  
  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitizedEmail)) {
    return res.status(400).json({ 
      error: 'Please provide a valid email address.' 
    });
  }
  
  // Password strength validation
  if (sanitizedPassword.length < 6) {
    return res.status(400).json({ 
      error: 'Password must be at least 6 characters long.' 
    });
  }
  
  // Username format validation
  if (sanitizedUsername.includes(' ')) {
    return res.status(400).json({ 
      error: 'Username cannot contain spaces.' 
    });
  }
  
  // Username length validation
  if (sanitizedUsername.length < 3 || sanitizedUsername.length > 20) {
    return res.status(400).json({ 
      error: 'Username must be between 3 and 20 characters long.' 
    });
  }
  
  try {
    console.log('Registration request:', {
      username: sanitizedUsername,
      email: sanitizedEmail,
      phone: sanitizedPhone || 'not provided',
      name: sanitizedName || 'not provided',
      dob: dob || 'not provided',
      sex: sex || 'not provided',
      bloodType: bloodType || 'not provided'
    });
    
    const hashedPassword = await bcrypt.hash(sanitizedPassword, saltRounds);
    
    // Use the register_external_user function
    const result = await pool.query(
      `SELECT * FROM register_external_user($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        sanitizedUsername,
        sanitizedEmail,
        hashedPassword,
        sanitizedPhone || null,
        sanitizedName || null,
        dob || null,
        sex || 'U',
        bloodType || 'UN'
      ]
    );
    
    const registrationResult = result.rows[0];
    console.log('User registered successfully:', {
      userId: registrationResult.user_id,
      patientId: registrationResult.new_patient_id,
      message: registrationResult.result_message
    });
    
    res.status(201).json({ 
      message: 'User registered successfully!', 
      user: {
        id: registrationResult.user_id,
        username: sanitizedUsername,
        patientId: registrationResult.new_patient_id
      }
    });
    
  } catch (err) {
    if (err.code === 'P0001') {
      // Database function error (e.g., username/email already exists)
      console.error('Database function error during registration:', err.message);
      return res.status(400).json({ error: err.message });
    }
    console.error('Registration error:', err.stack);
    res.status(500).json({ error: 'Server error during registration.' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  
  // Input sanitization
  const sanitizedEmail = email ? email.trim().toLowerCase() : '';
  const sanitizedPassword = password ? password.trim() : '';
  
  if (!sanitizedEmail || !sanitizedPassword) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  
  try {
    const result = await pool.query('SELECT * FROM external_user WHERE external_user_email = $1', [sanitizedEmail]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    const user = result.rows[0];
    const isMatch = await bcrypt.compare(sanitizedPassword, user.external_user_password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    // Create a JWT Token
    const token = jwt.sign(
      { 
        userId: user.external_user_id, 
        username: user.external_username,
        patientId: user.patient_id
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.status(200).json({
      message: 'Login successful!',
      token: token
    });
  } catch (err) {
    console.error('Login error:', err.stack);
    res.status(500).json({ error: 'Server error during login.' });
  }
};

exports.authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}; 