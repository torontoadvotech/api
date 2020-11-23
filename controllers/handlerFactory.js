const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const ApiFeatures = require('../utils/apiFeatures');

exports.getAll = (Model) => {
  return catchAsync(async (req, res, next) => {
    // To allow for nested GET sessions on mentor & mentee(hack)
    let filter = {};
    if (req.params.mentorId) filter = { mentor: req.params.mentorId };
    if (req.params.menteeId) filter = { mentee: req.params.menteeId };

    // Check if query has been set to show only mentors / mentees
    if (req.selectedRole) {
      filter.role = req.selectedRole;
    }
    const query = Model.find(filter);

    const features = new ApiFeatures(query, req.query)
      .filter()
      .sort()
      .limitFields()
      .paginate();

    const docs = await features.query;

    const count = await Model.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      count,
      results: docs.length,
      data: {
        data: docs,
      },
    });
  });
};

exports.getOne = (Model, populateOptions) => {
  return catchAsync(async (req, res, next) => {
    const query = Model.findById(req.params.id);

    if (populateOptions) query.populate(populateOptions);

    const doc = await query;

    if (!doc) {
      next(new AppError('Document does not exist', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  });
};

exports.updateOne = (Model) => {
  return catchAsync(async (req, res, next) => {
    const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  });
};

exports.deleteOne = (Model) => {
  return catchAsync(async (req, res, next) => {
    const doc = await Model.findByIdAndDelete(req.params.id);

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(204).json({
      status: 'success',
      data: null,
    });
  });
};
