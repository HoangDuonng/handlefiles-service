const express = require('express');
const router = express.Router();
const fileController = require('../controllers/file.controller');
const upload = require('../middlewares/fileUpload');

// Upload a single file
router.post('/upload', upload.single('file'), fileController.uploadFile);

// Delete a file
router.delete('/:context/:filename', fileController.deleteFile);
router.delete('/:context/:entityId/:filename', fileController.deleteFile);

// Get file info
router.get('/:context/:filename', fileController.getFileInfo);
router.get('/:context/:entityId/:filename', fileController.getFileInfo);

module.exports = router; 
