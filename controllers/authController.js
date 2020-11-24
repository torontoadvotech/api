const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const sendEmail = require('../utils/email');
const User = require('../models/userModel');

// JWT Token functions
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = catchAsync(async (user, statusCode, res) => {
  const token = signToken(user._id);
  const refreshToken = user.createRefreshToken();

  await user.save({ validateBeforeSave: false });

  const cookieOptions = {
    expires: new Date(
      // Convert from days to milliseconds
      Date.now() +
        process.env.JWT_REFRESH_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };

  // Require https in production
  if (process.env.NODE_ENV === 'production') {
    cookieOptions.secure = true;
  }

  res.cookie('refreshToken', refreshToken, cookieOptions);

  // Remove password data
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
});

// Sign up / Login

exports.signup = catchAsync(async (req, res, next) => {
  if (req.body.role && req.body.role.toLowerCase() === 'admin') {
    return next(
      new AppError('Admin accounts cannot be created using this route', 401)
    );
  }

  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    role: req.body.role,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    passwordChangedAt: req.body.passwordChangedAt,
  });

  sendEmail({
    email: req.body.email,
    subject: 'Verify your email address',
    message: `
        Click this link to verify your email address: http:localhost:8000/api/v1/users/validateEmail/${newUser._id}
      `,
  });

  // Log user in after signup
  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('Please provide email and password'), 400);
  }

  const user = await User.findOne({ email: req.body.email }).select(
    '+password'
  );

  // Check if user exists and if it does ensure password is correct
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  // Log the user in
  createSendToken(user, 201, res);
});

exports.logout = (req, res) => {
  // Replace valid refresh token with placeholder that expires in 10 seconds
  const expiryDate = new Date();
  expiryDate.setTime(expiryDate.getTime() + 10 * 1000);

  const cookieOptions = {
    expires: expiryDate,
    httpOnly: true,
  };

  res
    .cookie('refreshToken', 'loggedout', cookieOptions)
    .status(200)
    .json({ status: 'success' });
};

// Refresh JWT
exports.refreshToken = catchAsync(async (req, res, next) => {
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.cookies.refreshToken)
    .digest('hex');

  const user = await User.findOne({
    refreshToken: hashedToken,
    refreshTokenExpires: { $gt: Date.now() },
  });

  if (!user) return next(new AppError('Refresh token is no longer valid'));

  // Refresh the current token
  createSendToken(user, 201, res);
});

// Update / forgot password

exports.updateMyPassword = catchAsync(async (req, res, next) => {
  // req.user.id is coming from the protect middleware as user must be logged in to update password
  const user = await User.findById(req.user.id).select('+password');

  // ensure current password matches
  if (!(await user.correctPassword(req.body.currentPassword, user.password))) {
    return next(new AppError('Your current password is incorrect'));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;

  await user.save();

  createSendToken(user, 200, res);
});

exports.forgotMyPassword = catchAsync(async (req, res, next) => {
  // User will provide email for forgotten account password
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new AppError('No user exists with that email', 404));
  }

  // Generate reset token
  const resetToken = user.createPasswordResetToken();

  await user.save({ validateBeforeSave: false });

  // Create url for user to use to reset password
  const resetURL = `${req.protocol}://${req.get(
    'host'
  )}/api/v1/users/resetPassword/${resetToken}`;

  const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to ${resetURL} \nIf you didn't forget your password please ignore this email!`;

  try {
    // Send email to the user with the password reset link
    await sendEmail({
      email: user.email,
      subject: 'Your password reset token (valid for 10 minutes)',
      message,
    });

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email',
    });
  } catch (error) {
    // If the email fails to send delete the token and log the error
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    console.log(error);
  }
});

exports.resetPassword = async (req, res, next) => {
  // Hash the token provided and search users for the matching hashed token
  // Limit search to only tokens that have not expired
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(new AppError('Token is invalid or expired', 400));
  }

  // If the token is found save new password to user
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetExpires = undefined;
  user.passwordResetToken = undefined;

  await user.save();

  // log the user in
  createSendToken(user, 200, res);
};
// Middlewares

// Protect route to only be available to logged in users
exports.protect = catchAsync(async (req, res, next) => {
  // Get the JWT token from the authorization header if it exists
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('You are not logged in'));
  }

  // Validate the token
  // jwt.verify will throw an error and end the function if the payload has been altered or the token has expired
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // Use the decoded payload (which was set as the user ID) to lookup the user
  const currentUser = await User.findById(decoded.id);

  // If the user no longer exists or has recently changed the password send an error
  if (!currentUser) {
    return next(new AppError('User no longer exists'));
  }

  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User has recently changed password, please login again')
    );
  }

  // Save the current user to the req object before moving on to the next middleware
  req.user = currentUser;

  next();
});

// Restrict certain routes to only certain types of users (eg. admins)
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You are not authorized to access this route', 403)
      );
    }

    next();
  };
};
