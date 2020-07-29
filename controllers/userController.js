const multer = require("multer");
const sharp = require("sharp");
const { BlobServiceClient } = require("@azure/storage-blob");
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
exports.formatUserPhoto = catchAsync(async (req, res, next) => {
  // Move to the next middleware if no image uploaded
  if (!req.file) return next();

  // Format the uploaded image
  const formattedImage = await sharp(req.file.buffer)
    .resize(500, 500)
    .toFormat("jpeg")
    .jpeg({ quality: 90 })
    .toBuffer();

  // Overwrite the unformatted image with the formatted version
  req.file.buffer = formattedImage;

  next();
});
exports.uploadUserPhoto = catchAsync(async (req, res, next) => {
  // Move to the next middleware if no image uploaded
  if (!req.file) return next();

  const blobServiceClient = BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING
  );

  // 1. Get the user's Azure container or create one if it doesn't exist
  const containerName = req.user.id;
  const containerClient = blobServiceClient.getContainerClient(containerName);

  containerClient.createIfNotExists();

  // 2.Upload the image to the container
  // Create the blob
  const blobName = `profile-picture-${Date.now()}-${req.user.id}.jpeg`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  // Upload the data to the blob
  const image = req.file.buffer;
  const length = Buffer.byteLength(image);
  const uploadBlobResponse = await blockBlobClient.upload(image, length);

  // Save the file path to be stored in mongoDB
  req.file.filePath = `https://torontoadvotech.blob.core.windows.net/${req.user.id}/${blobName}`;

  if (uploadBlobResponse.errorCode) {
    return next(new AppError("Error uploading photo", 500));
  }

  next();
});

// Update current user

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};

  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) {
      newObj[el] = obj[el];
    }
  });

  return newObj;
};

exports.updateMe = catchAsync(async (req, res, next) => {
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        "This route is not for password updates, use /updateMyPassword",
        400
      )
    );
  }

  //Restrict the fields users can update with this route
  const filteredBody = filterObj(
    req.body,
    "name",
    "email",
    "pronouns",
    "bio",
    "location"
  );

  // If a photo is uploaded add the path to the body
  if (req.file) filteredBody.photo = req.file.filePath;

  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
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
