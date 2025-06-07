require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const logger = require('./middlewares/logger');
const path = require('path');

// Import configurations
const setupMiddleware = require('./middlewares/middleware');
const setupRoutes = require('./routes/routes');
const setupStorage = require('./config/storage');

// Khởi tạo app
const app = express();

// Cấu hình cho request lớn
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// HTTP request logging
app.use(morgan('combined', { stream: logger.stream }));

// Thiết lập storage
setupStorage();

// Thiết lập middleware
setupMiddleware(app);

// Thiết lập routes
setupRoutes(app);

// Serve static files
const FILE_STORAGE_ROOT = process.env.FILE_STORAGE_ROOT;
app.use('/static_files', express.static(path.join(FILE_STORAGE_ROOT)));

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = app; 
