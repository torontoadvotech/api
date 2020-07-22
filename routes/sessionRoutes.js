const express = require('express');
const authController = require('../controllers/authController');
const sessionController = require('../controllers/sessionController');

const router = express.Router({ mergeParams: true });

router.use(authController.protect);

router
  .route('/')
  .get(authController.restrictTo('admin'), sessionController.getAllSessions)
  .post(
    authController.restrictTo('mentee'),
    sessionController.setMentorMenteeIds,
    sessionController.requestSession
  );

router.get('/mySessions', sessionController.getMySessions);

router.patch(
  '/sessionResponse/:sessionId',
  authController.restrictTo('mentor'),
  sessionController.acceptRejectSession
);
module.exports = router;
