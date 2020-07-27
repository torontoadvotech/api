const express = require("express");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const hpp = require("hpp");
const cookieParser = require("cookie-parser");
const globalErrorHandler = require("./controllers/errorController");
const AppError = require("./utils/appError");
const bodyParser = require("body-parser");

const userRouter = require("./routes/userRoutes");
const mentorRouter = require("./routes/mentorRoutes");
const menteeRouter = require("./routes/menteeRoutes");
const sessionRouter = require("./routes/sessionRoutes");

const app = express();

// 1) GLOBAL MIDDLEWARES
// Allow cross origin requests
const corsOptions = {
  origin: "http://localhost:8888",
  credentials: true,
};
app.use(cors(corsOptions));

// Set security HTTP Headers
app.use(helmet());

// Development logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Limit requests from same IP
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: "Too many requests from this IP, please try again in 1 hour",
});

app.use("/api", limiter);

// Body parser, reading data from the body into req.body
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against cross site scripting attacks (XSS)
app.use(xss());

// Prevent parameter pollution
app.use(
  hpp({
    whitelist: [],
  })
);

//Parse cookies
app.use(cookieParser());

// Serving static files
app.use(express.static(`${__dirname}/public`));

app.use("/api/v1/users", userRouter);
app.use("/api/v1/mentors", mentorRouter);
app.use("/api/v1/mentees", menteeRouter);
app.use("/api/v1/sessions", sessionRouter);

app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
