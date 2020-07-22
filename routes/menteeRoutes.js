const express = require('express');
const menteeController = require('../controllers/menteeController');
const userController = require('../controllers/userController');
const sessionRouter = require('./sessionRoutes');

const router = express.Router();

// Use session router to get sessions from specific mentor
router.use('/:menteeId/sessions', sessionRouter);

router
  .route('/')
  .get(userController.showOnly('mentee'), menteeController.getAllMentees);

module.exports = router;
