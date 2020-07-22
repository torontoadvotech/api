const express = require('express');
const mentorController = require('../controllers/mentorController');
const userController = require('../controllers/userController');
const sessionRouter = require('./sessionRoutes');

const router = express.Router();

// Use session router to get sessions from specific mentor
router.use('/:mentorId/sessions', sessionRouter);

router
  .route('/')
  .get(userController.showOnly('mentor'), mentorController.getAllMentors);

module.exports = router;
