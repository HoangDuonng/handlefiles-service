const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Tạo thư mục logs nếu chưa tồn tại
const logDir = process.env.LOG_DIR || 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Định dạng log
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Cấu hình các transport
const transports = [
  // Log tất cả các level vào file combined.log
  new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    level: process.env.LOG_LEVEL || 'info'
  }),
  // Log các lỗi vào file error.log
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error'
  })
];

// Thêm console transport trong môi trường development
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  );
}

// Tạo logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'handlefiles-service' },
  transports: transports
});

// Tạo stream cho Morgan
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

module.exports = logger; 
