const catchAsync = require('../utils/catchAsync');
const sendEmail = require('../utils/email');
const AppError = require('../utils/appError');
const handlerFactory = require('./handlerFactory');

const Session = require('../models/sessionModel');
const User = require('../models/userModel');

exports.setMentorMenteeIds = (req, res, next) => {
  // This is currently only setup for a logged in mentee on a route with a mentor param

  if (!req.body.mentor) req.body.mentor = req.params.mentorId;
  if (!req.body.mentee) req.body.mentee = req.user.id;

  next();
};

exports.requestSession = catchAsync(async (req, res, next) => {
  const session = await Session.create(req.body);
  const mentor = await User.findById(req.body.mentor);

  const message = `You have received a new request for mentorship from ${req.user.name}! To view this request log into your account at www.torontoadvotech.com/login`;

  try {
    await sendEmail({
      email: mentor.email,
      subject: 'New mentorship request!',
      message,
    });

    res.status(200).json({
      status: 'success',
      data: {
        session,
      },
    });
  } catch (error) {
    console.log(error);
  }
});

exports.acceptRejectSession = catchAsync(async (req, res, next) => {
  const session = await Session.findOne({
    _id: req.params.sessionId,
    mentor: req.user.id,
  });

  if (!session) {
    return next('No unconfirmed session matches id provided', 404);
  }
  let subject;
  let message;

  console.log(req.body.accepted);

  if (req.body.accepted == true) {
    session.confirmed = true;
    session.rejected = false;
    session.cancelled = false;
    subject = `Your mentorship request has been accepted!`;
    message = `Your mentorship request with ${req.user.name} has been accepted! To review this session log into your account at www.torontoadvotech.com/login`;
  } else if (req.body.accepted == false) {
    session.rejected = true;
    session.confirmed = false;
    session.cancelled = false;
    subject = `Your mentorship request has been rejected`;
    message = `Your mentorship request with ${req.user.name} has been rejected. To send a new request log into your account at www.torontoadvotech.com/login`;
  } else {
    return next(new AppError('The session must be accepted or rejected', 400));
  }

  try {
    await session.save();
    await sendEmail({
      email: session.mentee.email,
      subject,
      message,
    });

    res.status('200').json({
      status: 'success',
      session,
    });
  } catch (error) {
    console.log(error);
  }
});

exports.cancelSession = catchAsync(async (req, res, next) => {
  const session = await Session.findOne({
    _id: req.params.sessionId,
  });

  if (!session) {
    return next(new AppError('No session matches id provided', 404));
  }

  if (session.confirmed !== true) {
    return next(
      new AppError('Session must be in accepted status to be cancelled', 404)
    );
  }

  session.confirmed = false;
  session.cancelled = true;

  const otherUserRole = req.user.role === 'mentee' ? 'mentor' : 'mentee';

  try {
    await session.save();
    await sendEmail({
      email: session[otherUserRole].email,
      subject: 'Your mentoring session has been cancelled',
      message: `Your mentorship request with ${req.user.name} has been cancelled. To send a new request log into your account at www.torontoadvotech.com/login`,
    });

    res.status('200').json({
      status: 'success',
      session,
    });
  } catch (error) {
    console.log(error);
  }
});

exports.getMySessions = catchAsync(async (req, res, next) => {
  const sessions = await Session.find({ [req.user.role]: req.user.id });

  res.status(200).json({
    status: 'success',
    data: {
      sessions,
    },
  });
});

exports.getAllSessions = handlerFactory.getAll(Session);
