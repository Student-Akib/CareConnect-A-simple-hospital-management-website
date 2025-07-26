// server/db.js
const { Pool } = require('pg');
require('dotenv').config();

// Use connection string if available, otherwise use individual variables
const pool = new Pool(
  process.env.DATABASE_URL 
    ? { connectionString: process.env.DATABASE_URL }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT || 5432,
      }
);

module.exports = pool;