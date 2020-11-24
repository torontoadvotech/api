const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'A user must have a name'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'A user must have an email'],
    unique: [true, 'This email has already been used'],
    lowercase: true,
    valdate: [validator.isEmail, 'Email is invalid'],
  },
  photo: {
    type: String,
  },
  bio: {
    type: String,
    maxlength: [500, 'Maximum of 500 characters for bio'],
  },
  pronouns: String,
  role: {
    type: String,
    enum: ['mentor', 'mentee', 'admin'],
    default: 'mentee',
  },
  location: {
    type: {
      type: String,
      default: 'Point',
      enum: ['Point'],
    },
    coordinates: [Number],
    description: String,
  },
  password: {
    type: String,
    required: [true, 'A password must be provided'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false,
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password'],
    validate: {
      // This validator will ONLY work on save or create, not update!
      validator: function(val) {
        return val === this.password;
      },
      message: 'Passwords do not match',
    },
  },
  mentors: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
  ],
  mentees: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
  ],
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  refreshToken: String,
  refreshTokenExpires: Date,
  validatedEmail: {
    type: Boolean,
    default: false,
    select: false,
  },

  active: {
    type: Boolean,
    default: true,
    select: false,
  },
});

// Document Middleware

// Hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, 12);

  this.passwordConfirm = undefined;

  next();
});

// Set password changed at if password is changed & user isn't new
userSchema.pre('save', function(next) {
  if (!this.isModified('password') || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000;

  next();
});

// Query Middleware

// Only show active users
userSchema.pre(/^find/, function(next) {
  this.find({ active: { $ne: false } });

  next();
});

// Populate referenced mentors/mentees
userSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'user',
    select: 'name photo bio',
  });

  next();
});

// Methods

userSchema.methods.correctPassword = async function(
  candidatePassword,
  currentPassword
) {
  return await bcrypt.compare(candidatePassword, currentPassword);
};

userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const convertedTimeStamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < convertedTimeStamp;
  }

  // false means NOT changed
  return false;
};

userSchema.methods.createRefreshToken = function() {
  const refreshToken = crypto.randomBytes(32).toString('hex');

  this.refreshToken = crypto
    .createHash('sha256')
    .update(refreshToken)
    .digest('hex');

  this.refreshTokenExpires =
    Date.now() + process.env.JWT_REFRESH_COOKIE_EXPIRES_IN * 60 * 60 * 1000;

  return refreshToken;
};

userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // 10 minutes
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
