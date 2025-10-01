const express = require('express');
const cors = require('cors');

const setupMiddleware = (app) => {
  // CORS middleware
  app.use(cors());

  // Body parser middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  });
};

module.exports = setupMiddleware; 
