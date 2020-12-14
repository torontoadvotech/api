const handlerFactory = require('./handlerFactory');
const User = require('../models/userModel');

exports.getAllMentors = handlerFactory.getAll(User);

exports.getOneMentor = handlerFactory.getOne(User);
