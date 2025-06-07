class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Các loại lỗi thường gặp
const ErrorTypes = {
  VALIDATION_ERROR: 'ValidationError',
  CAST_ERROR: 'CastError',
  DUPLICATE_KEY_ERROR: 'DuplicateKeyError',
  FILE_ERROR: 'FileError',
  DATABASE_ERROR: 'DatabaseError',
  AUTHENTICATION_ERROR: 'AuthenticationError',
  AUTHORIZATION_ERROR: 'AuthorizationError'
};

// Hàm tạo lỗi
const createError = (message, statusCode = 500) => {
  return new AppError(message, statusCode);
};

// Hàm xử lý lỗi MongoDB
const handleMongoError = (error) => {
  if (error.name === ErrorTypes.VALIDATION_ERROR) {
    return createError('Dữ liệu không hợp lệ', 400);
  }
  if (error.name === ErrorTypes.CAST_ERROR) {
    return createError('ID không hợp lệ', 400);
  }
  if (error.code === 11000) {
    return createError('Dữ liệu đã tồn tại', 400);
  }
  return createError('Lỗi database', 500);
};

// Hàm xử lý lỗi file
const handleFileError = (error) => {
  if (error.code === 'ENOENT') {
    return createError('File không tồn tại', 404);
  }
  if (error.code === 'EACCES') {
    return createError('Không có quyền truy cập file', 403);
  }
  return createError('Lỗi xử lý file', 500);
};

module.exports = {
  AppError,
  ErrorTypes,
  createError,
  handleMongoError,
  handleFileError
}; 
