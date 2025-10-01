const express = require('express');
const router = express.Router();
const fileController = require('../controllers/file.controller');
const upload = require('../middlewares/fileUpload');
const { getFileContent } = require('../controllers/file.controller');

// Upload a single file

router.post('/upload', upload.single('file'), fileController.uploadFile);

// Upload multiple files
router.post('/upload-multiple', upload.array('files', 20), fileController.uploadMultipleFiles);

// Delete a file
router.delete('/:context/:filename', fileController.deleteFile);
router.delete('/:context/:entityId/:filename', fileController.deleteFile);

// Xóa tất cả ảnh theo context + entityId
router.delete('/bulk/:context/:entityId', fileController.deleteFilesByEntity);

// Route lấy file ảnh thực tế mới (ưu tiên đặt trước)
router.get('/image/:context/:filename', fileController.getImageFile);
router.get('/image/:context/:entityId/:filename', fileController.getImageFile);

// Route lấy file thực tế
router.get('/content/:context/:filename', getFileContent);
router.get('/content/:context/:entityId/:filename', getFileContent);

// Route lấy thông tin file (đặt sau cùng)
router.get('/:context/:filename', fileController.getFileInfo);
router.get('/:context/:entityId/:filename', fileController.getFileInfo);

module.exports = router; 
