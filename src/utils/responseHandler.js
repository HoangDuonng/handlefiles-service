const logger = require('../middlewares/logger');

// Hàm tạo response thành công
const successResponse = (res, data = null, message = 'Thành công', statusCode = 200) => {
  const response = {
    success: true,
    message,
    data
  };

  return res.status(statusCode).json(response);
};

// Hàm tạo response lỗi
const errorResponse = (res, error, statusCode = 500) => {
  logger.error('API Error:', {
    error: error.message,
    stack: error.stack,
    statusCode
  });

  const response = {
    success: false,
    message: error.message || 'Lỗi server',
    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
  };

  return res.status(statusCode).json(response);
};

// Hàm tạo response không tìm thấy
const notFoundResponse = (res, message = 'Không tìm thấy dữ liệu') => {
  return errorResponse(res, { message }, 404);
};

// Hàm tạo response validation error
const validationErrorResponse = (res, errors) => {
  return errorResponse(res, { 
    message: 'Dữ liệu không hợp lệ',
    errors 
  }, 400);
};

// Hàm tạo response unauthorized
const unauthorizedResponse = (res, message = 'Không có quyền truy cập') => {
  return errorResponse(res, { message }, 401);
};

// Hàm tạo response forbidden
const forbiddenResponse = (res, message = 'Truy cập bị cấm') => {
  return errorResponse(res, { message }, 403);
};

module.exports = {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  unauthorizedResponse,
  forbiddenResponse
}; 
