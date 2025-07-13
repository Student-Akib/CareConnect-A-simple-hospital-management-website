// server/server.js

// 1. Import Dependencies
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); // For creating tokens

// 2. Initialize Express App & Constants
const app = express();
const PORT = 3000;
const saltRounds = 10;
const JWT_SECRET = 'your_super_secret_key_that_should_be_in_an_env_file'; // In a real app, use an environment variable!

// 3. Middlewares
app.use(cors());
app.use(express.json());

// 4. PostgreSQL Connection Setup
const pool = new Pool({
  user: 'dba0',
  host: 'localhost',
  database: 'h0',
  password: 'dba0',
  port: 5432,
});

// 5. API Endpoints

// --- Branch Endpoints ---
app.get('/api/branches', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM branch ORDER BY branch_name');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching branches:', err.stack);
    res.status(500).json({ message: 'Error fetching branches' });
  }
});

// --- Auth Endpoints ---
app.post('/api/users/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const result = await pool.query(
      'INSERT INTO external_user (external_username, external_user_email, external_user_password_hash) VALUES ($1, $2, $3) RETURNING external_user_id, external_username',
      [username, email, hashedPassword]
    );
    res.status(201).json({ message: 'User registered successfully!', user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Username or email already exists.' });
    }
    console.error('Registration error:', err.stack);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

// LOGIN ENDPOINT - NOW ISSUES A JWT TOKEN
app.post('/api/users/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }
    try {
        const result = await pool.query('SELECT * FROM external_user WHERE external_user_email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.external_user_password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // Create a JWT Token
        const token = jwt.sign(
            { userId: user.external_user_id, username: user.external_username },
            JWT_SECRET,
            { expiresIn: '1h' } // Token expires in 1 hour
        );

        res.status(200).json({
            message: 'Login successful!',
            token: token // Send the token to the frontend
        });
    } catch (err) {
        console.error('Login error:', err.stack);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

// --- NEW: Middleware to verify JWT token ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) return res.sendStatus(401); // if there isn't any token

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // if token is no longer valid
        req.user = user;
        next(); // move on to the next middleware or the route handler
    });
};

// --- NEW: Protected Dashboard Data Endpoint ---
app.get('/api/users/dashboard', authenticateToken, (req, res) => {
    // The user object is attached to the request by the authenticateToken middleware
    // This sends back the user's info from the token.
    res.json({
        message: `Welcome to your dashboard, ${req.user.username}!`,
        user: req.user
    });
});


// 6. Start the Server
app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
