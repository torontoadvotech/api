const multer = require("multer");
const sharp = require("sharp");
const User = require("../models/userModel");
const handlerFactory = require("./handlerFactory");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;

  next();
};

// Handling user profile pictures
const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  console.log("file", file);
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new AppError("Not an image! please upload only images", 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.storeUserPhoto = upload.single("photo");
exports.uploadUserPhoto = catchAsync(async (req, res, next) => {
  console.log("file", req.file);

  next();
});

exports.updateMe = catchAsync(async (req, res, next) => {
  console.log(req.body);
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        "This route is not for password updates, use /updateMyPassword",
        400
      )
    );
  }

  //TODO: Restrict the fields users can update with this route

  const updatedUser = await User.findByIdAndUpdate(req.user.id, req.body, {
    runValidators: true,
    new: true,
  });

  res.status(200).json({
    status: "success",
    data: {
      data: updatedUser,
    },
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });

  res.status(204).json({
    status: "success",
    data: null,
  });
});

exports.showOnly = (role) => {
  return catchAsync(async (req, res, next) => {
    const users = User.find({ role: role });

    req.showOnlyQuery = users;

    next();
  });
};

exports.getAllUsers = handlerFactory.getAll(User);
exports.getUser = handlerFactory.getOne(User);
exports.updateUser = handlerFactory.updateOne(User);
exports.deleteUser = handlerFactory.deleteOne(User);

exports.createUser = (req, res) => {
  res.status(500).json({
    status: "error",
    message: "this route is not defined, please use /signup instead",
  });
};
