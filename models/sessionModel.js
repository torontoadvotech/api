const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: [true, 'A session must have a date']
  },
  mentee: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'A session must have a mentee']
  },
  mentor: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'A session must have a mentor']
  },
  requestedAt: {
    type: Date,
    default: Date.now()
  },
  confirmed: {
    type: Boolean,
    default: false
  },
  rejected: {
    type: Boolean,
    default: false
  },
  confirmedAt: Date
});

// Populate referenced mentors/mentees
sessionSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'mentee',
    select: 'name photo pronouns'
  });
  this.populate({
    path: 'mentor',
    select: 'name photo pronouns'
  });

  next();
});

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
