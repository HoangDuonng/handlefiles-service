const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { createError } = require('./errorHandler');

// Hàm tạo tên file an toàn
const generateSafeFilename = (originalFilename) => {
  const ext = path.extname(originalFilename);
  return `${uuidv4()}${ext}`;
};

// Hàm tạo thư mục nếu chưa tồn tại
const ensureDirectoryExists = async (dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    throw createError('Không thể tạo thư mục', 500);
  }
};

// Hàm xóa file
const deleteFile = async (filePath) => {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw createError('Không thể xóa file', 500);
    }
  }
};

// Hàm xóa thư mục và nội dung
const deleteDirectory = async (dirPath) => {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw createError('Không thể xóa thư mục', 500);
    }
  }
};

// Hàm kiểm tra kích thước file
const checkFileSize = (fileSize, maxSize) => {
  if (fileSize > maxSize) {
    throw createError(`File vượt quá kích thước cho phép (${maxSize / (1024 * 1024)}MB)`, 400);
  }
};

// Hàm kiểm tra loại file
const checkFileType = (mimetype, allowedTypes) => {
  if (!allowedTypes.includes(mimetype)) {
    throw createError('Loại file không được hỗ trợ', 400);
  }
};

// Hàm lấy thông tin file
const getFileInfo = async (filePath) => {
  try {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime
    };
  } catch (error) {
    throw createError('Không thể đọc thông tin file', 500);
  }
};

// Hàm đọc nội dung file
const readFile = async (filePath) => {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    throw createError('Không thể đọc file', 500);
  }
};

// Hàm ghi nội dung file
const writeFile = async (filePath, content) => {
  try {
    await fs.writeFile(filePath, content, 'utf8');
  } catch (error) {
    throw createError('Không thể ghi file', 500);
  }
};

module.exports = {
  generateSafeFilename,
  ensureDirectoryExists,
  deleteFile,
  deleteDirectory,
  checkFileSize,
  checkFileType,
  getFileInfo,
  readFile,
  writeFile
}; 
