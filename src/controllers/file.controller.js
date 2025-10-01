const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

const { 
  generateSafeFilename, 
  ensureDirectoryExists, 
  deleteFile, 
  getFileInfo,
  deleteDirectory 
} = require('../utils/fileHandler');
const { 
  successResponse, 
  errorResponse, 
  notFoundResponse 
} = require('../utils/responseHandler');
const { validateRequired } = require('../utils/validator');
const logger = require('../middlewares/logger');
const File = require('../models/file.model');
const fileService = require('../services/file.service');

const fileController = {
  
  // Upload a single file
  uploadFile: async (req, res) => {
    try {
      const result = await fileService.uploadFile(req.file, req.body);
      // Tạo url trả về cho frontend
      const { context, entityId } = result;
      const baseUrl = req.protocol + '://' + req.get('host');
      let url = baseUrl + '/api/handlefile/files/' + context + '/';
      if (entityId) url += entityId + '/';
      url += result.filename;
      // Bổ sung type, position nếu có gửi lên
      const type = req.body.type || null;
      const position = req.body.position || null;
      return successResponse(res, {
        ...result.toObject(),
        url,
        ...(type && { type }),
        ...(position && { position })
      }, 'File uploaded successfully');
    } catch (error) {
      return errorResponse(res, error);
    }
  },

  // Upload multiple files
  uploadMultipleFiles: async (req, res) => {
    try {
      const results = await fileService.uploadMultipleFiles(req.files, req.body);
      const baseUrl = req.protocol + '://' + req.get('host');
      const { context, entityId } = results[0];
      
      // Tạo URL cho từng file
      const filesWithUrls = results.map(file => {
        let url = baseUrl + '/api/handlefile/files/image/' + context + '/';
        if (entityId) url += entityId + '/';
        url += file.filename;
        
        const type = req.body.type || null;
        const position = req.body.position || null;
        
        return {
          ...file.toObject(),
          url,
          ...(type && { type }),
          ...(position && { position })
        };
      });
      
      return successResponse(res, filesWithUrls, `${filesWithUrls.length} files uploaded successfully`);
    } catch (error) {
      return errorResponse(res, error);
    }
  },


  // Delete a file
  
  deleteFile: async (req, res) => {
    try {
      await fileService.deleteFile(req.params);
      return successResponse(res, null, 'File deleted successfully');
    } catch (error) {
      return errorResponse(res, error);
    }
  },
  

  // Get file info
  
  getFileInfo: async (req, res) => {
    try {
      const result = await fileService.getFileInfo(req.params);
      return successResponse(res, result, 'File info retrieved');
    } catch (error) {
      return errorResponse(res, error);
    }
  },
  

  
  getFileContent: async (req, res) => {
    try {
      const filePath = await fileService.getFileContent(req.params);
      return res.sendFile(filePath);
    } catch (error) {
      if (error.status === 404) {
        return res.status(404).send('File not found');
      }
      return res.status(500).send('Error serving file');
    }
  },
  

  getImageFile: async (req, res) => {
    try {
      const { context, filename, entityId } = req.params;
      const fileStorageRoot = process.env.FILE_STORAGE_ROOT
        ? path.resolve(process.env.FILE_STORAGE_ROOT)
        : path.join(__dirname, '..', 'file_storage_root');
      const filePath = entityId
        ? path.join(fileStorageRoot, context, entityId, filename)
        : path.join(fileStorageRoot, context, filename);

      const fsSync = require('fs');

      if (!fsSync.existsSync(filePath)) {
        return res.status(404).send('File not found');
      }
      return res.sendFile(path.resolve(filePath));
    } catch (error) {
      console.error('Error serving file:', error);
      return res.status(500).send('Error serving file');
    }
  },

  deleteFilesByEntity: async (req, res) => {
    try {
      const { context, entityId } = req.params;
      await fileService.deleteFilesByEntity({ context, entityId });
      return successResponse(res, null, 'All files deleted successfully');
    } catch (error) {
      return errorResponse(res, error);
    }
  }
};

module.exports = fileController; 
