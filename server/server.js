// server/server.js

// 1. Import Dependencies
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const pool = require('./db');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static('../public'));



// Import routes
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const branchesRoutes = require('./routes/branchesRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
// Add more route imports as needed

// Test database connection on server start
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Failed to connect to PostgreSQL database:', err.message);
  } else {
    console.log('✅ Connected to PostgreSQL database successfully!');
    release();
  }
});

app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/branches', branchesRoutes);
app.use('/api/appointments', appointmentRoutes);
// Add more route uses as needed

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err.message);
  res.status(500).json({ error: 'Internal server error.' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
