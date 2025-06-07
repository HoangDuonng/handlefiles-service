const app = require('./app');
const logger = require('./middlewares/logger');
const connectDB = require('./config/database');

// Xử lý uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

// Xử lý unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', {
    reason: reason,
    promise: promise
  });
});

// Khởi động server
const startServer = async () => {
  try {
    // Kết nối database
    await connectDB();

    // Khởi động server
    const PORT = process.env.PORT || 8087;
    app.listen(PORT, () => {
      logger.info(`Server đang chạy tại cổng ${PORT}`, {
        port: PORT,
        environment: process.env.NODE_ENV
      });
    });
  } catch (error) {
    logger.error('Lỗi khởi động server:', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

startServer(); 
