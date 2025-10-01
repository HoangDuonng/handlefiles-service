const { createError } = require('./errorHandler');

// Hàm validate email
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw createError('Email không hợp lệ', 400);
  }
  return true;
};

// Hàm validate password
const validatePassword = (password) => {
  if (password.length < 8) {
    throw createError('Mật khẩu phải có ít nhất 8 ký tự', 400);
  }
  if (!/[A-Z]/.test(password)) {
    throw createError('Mật khẩu phải có ít nhất 1 chữ hoa', 400);
  }
  if (!/[a-z]/.test(password)) {
    throw createError('Mật khẩu phải có ít nhất 1 chữ thường', 400);
  }
  if (!/[0-9]/.test(password)) {
    throw createError('Mật khẩu phải có ít nhất 1 số', 400);
  }
  return true;
};

// Hàm validate phone number
const validatePhone = (phone) => {
  const phoneRegex = /^[0-9]{10}$/;
  if (!phoneRegex.test(phone)) {
    throw createError('Số điện thoại không hợp lệ', 400);
  }
  return true;
};

// Hàm validate required fields
const validateRequired = (data, fields) => {
  const missingFields = fields.filter(field => !data[field]);
  if (missingFields.length > 0) {
    throw createError(`Thiếu các trường bắt buộc: ${missingFields.join(', ')}`, 400);
  }
  return true;
};

// Hàm validate string length
const validateLength = (str, min, max) => {
  if (str.length < min || str.length > max) {
    throw createError(`Độ dài phải từ ${min} đến ${max} ký tự`, 400);
  }
  return true;
};

// Hàm validate number range
const validateRange = (num, min, max) => {
  if (num < min || num > max) {
    throw createError(`Giá trị phải từ ${min} đến ${max}`, 400);
  }
  return true;
};

// Hàm validate date
const validateDate = (date) => {
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    throw createError('Ngày không hợp lệ', 400);
  }
  return true;
};

// Hàm validate URL
const validateUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    throw createError('URL không hợp lệ', 400);
  }
};

module.exports = {
  validateEmail,
  validatePassword,
  validatePhone,
  validateRequired,
  validateLength,
  validateRange,
  validateDate,
  validateUrl
}; 
