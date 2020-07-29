const express = require("express");
const authController = require("../controllers/authController");
const userController = require("../controllers/userController");

const router = express.Router();

router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.get("/logout", authController.logout);
router.post("/refreshToken", authController.refreshToken);

router.post("/forgotMyPassword", authController.forgotMyPassword);
router.patch("/resetPassword/:token", authController.resetPassword);

// Require login for all routes below here
router.use(authController.protect);

router.get("/getMe", userController.getMe, userController.getUser);
router.patch(
  "/updateMe",
  userController.storeUserPhoto,
  userController.formatUserPhoto,
  userController.uploadUserPhoto,
  userController.updateMe
);
router.delete("/deleteMe", userController.deleteMe);

router.patch("/updateMyPassword", authController.updateMyPassword);

// Require Admin for all routes below here
router.use(authController.restrictTo("admin"));

router
  .route("/")
  .get(userController.getAllUsers)
  .post(userController.createUser);

router
  .route("/:id")
  .get(userController.getUser)
  .patch(userController.updateUser)
  .delete(userController.deleteUser);

module.exports = router;
