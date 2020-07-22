const handlerFactory = require('./handlerFactory');
const User = require('../models/userModel');

exports.getAllMentees = handlerFactory.getAll(User);
