const express = require('express');
const router = express.Router();
const branchesController = require('../controllers/branchesController');

// GET /api/branches
router.get('/', branchesController.getAllBranches);

module.exports = router; 