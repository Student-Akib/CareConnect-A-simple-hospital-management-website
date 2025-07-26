const pool = require('../db');

exports.getAllBranches = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM branch ORDER BY branch_name');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching branches:', err.stack);
    res.status(500).json({ error: 'Error fetching branches' });
  }
}; 