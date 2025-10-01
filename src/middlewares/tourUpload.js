const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Cấu hình storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const tempDir = process.env.TEMP_UPLOADS_DIR || './temp_uploads';
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = uuidv4();
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Chỉ chấp nhận file ZIP
  if (file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed') {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file ZIP'), false);
  }
};

// Cấu hình upload
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_TOUR_SIZE) || 500 * 1024 * 1024, // 500MB mặc định
    fieldSize: 50 * 1024 * 1024 // 50MB cho các trường khác
  }
});

module.exports = upload; 
