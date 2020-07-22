const mongoose = require('mongoose');
const dotenv = require('dotenv');

process.on('uncaughtException', err => {
  console.log('UNCAUGHT EXCEPTION Shutting down...');
  console.log(err.name, err.message, err.stack);

  process.exit(1); // Code 1 stands for uncaught exception
});

dotenv.config({ path: './config.env' });

const app = require('./app.js');

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false
  })
  .then(() => console.log('DB Connection Successful'));

const port = process.env.PORT || 3000;

const server = app.listen(port, () => {
  console.log(`app running on port ${port}`);
});

process.on('unhandledRejection', err => {
  console.log('UNHANDLED REJECTION Shutting down...');
  console.log(err.name, err.message, err.stack);

  server.close(() => {
    // server.close() gives the server time to finish pending requests before ending (graceful exit)
    process.exit(1); // Code 1 stands for uncaught exception
  });
});
