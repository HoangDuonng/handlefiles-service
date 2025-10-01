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

const fileController = {
  // Upload a single file
  uploadFile: async (req, res) => {
    try {
      if (!req.file) {
        return errorResponse(res, { message: 'No file uploaded' }, 400);
      }

      // Validate required fields
      validateRequired(req.body, ['context']);

      const { context, entityId } = req.body;
      const fileStorageRoot = process.env.FILE_STORAGE_ROOT || './file_storage_root';
      const contextDir = path.join(fileStorageRoot, context);
      
      // Create context directory if it doesn't exist
      await ensureDirectoryExists(contextDir);

      // If entityId is provided, create a subdirectory for it
      const targetDir = entityId 
        ? path.join(contextDir, entityId)
        : contextDir;

      await ensureDirectoryExists(targetDir);

      // Generate new filename and move file
      const newFilename = generateSafeFilename(req.file.originalname);
      const targetPath = path.join(targetDir, newFilename);

      // Move file from temp to final location
      await fs.rename(req.file.path, targetPath);

      // Create file record in MongoDB
      const file = new File({
        filename: newFilename,
        originalName: req.file.originalname,
        path: targetPath,
        size: req.file.size,
        mimetype: req.file.mimetype,
        context,
        entityId
      });

      await file.save();

      logger.info('File uploaded successfully', {
        context,
        entityId,
        filename: newFilename,
        size: req.file.size
      });

      return successResponse(res, file, 'File uploaded successfully');
    } catch (error) {
      logger.error('File upload error:', {
        error: error.message,
        stack: error.stack,
        context: req.body.context,
        entityId: req.body.entityId
      });
      return errorResponse(res, error);
    }
  },

  // Delete a file
  deleteFile: async (req, res) => {
    try {
      const { context, filename, entityId } = req.params;
      const fileStorageRoot = process.env.FILE_STORAGE_ROOT || './file_storage_root';
      
      const filePath = entityId
        ? path.join(fileStorageRoot, context, entityId, filename)
        : path.join(fileStorageRoot, context, filename);

      // Check if file exists in storage
      try {
        await fs.access(filePath);
      } catch (error) {
        logger.warn('File not found in storage', {
          context,
          entityId,
          filename,
          path: filePath
        });
        return notFoundResponse(res, 'File not found in storage');
      }

      // Check if file exists in database
      const file = await File.findOne({
        context,
        filename,
        entityId: entityId || null
      });

      if (!file) {
        logger.warn('File not found in database', {
          context,
          entityId,
          filename
        });
        return notFoundResponse(res, 'File not found in database');
      }

      // Delete file from storage
      await deleteFile(filePath);

      // Delete file record from MongoDB
      await file.deleteOne();

      // If entityId is provided, check if directory is empty
      if (entityId) {
        const entityDir = path.join(fileStorageRoot, context, entityId);
        try {
          const files = await fs.readdir(entityDir);
          if (files.length === 0) {
            // Delete empty directory
            await deleteDirectory(entityDir);
            logger.info('Empty entity directory deleted', {
              context,
              entityId
            });
          }
        } catch (dirError) {
          logger.error('Error checking entity directory', {
            error: dirError.message,
            context,
            entityId
          });
        }
      }

      logger.info('File deleted successfully', {
        context,
        entityId,
        filename
      });

      return successResponse(res, null, 'File deleted successfully');
    } catch (error) {
      logger.error('File deletion error:', {
        error: error.message,
        stack: error.stack,
        context: req.params.context,
        filename: req.params.filename
      });
      return errorResponse(res, error);
    }
  },

  // Get file info
  getFileInfo: async (req, res) => {
    try {
      const { context, filename, entityId } = req.params;

      // Get file info from MongoDB
      const file = await File.findOne({
        context,
        filename,
        entityId: entityId || null
      });

      if (!file) {
        return notFoundResponse(res, 'File not found');
      }

      // Check if file exists in storage
      try {
        await fs.access(file.path);
      } catch (error) {
        logger.warn('File not found in storage', {
          context,
          entityId,
          filename,
          path: file.path
        });
        return notFoundResponse(res, 'File not found in storage');
      }

      // Get additional file info from storage
      const fileInfo = await getFileInfo(file.path);

      logger.info('File info retrieved', {
        context,
        entityId,
        filename
      });

      return successResponse(res, {
        ...file.toObject(),
        ...fileInfo
      });
    } catch (error) {
      logger.error('File info error:', {
        error: error.message,
        stack: error.stack,
        context: req.params.context,
        filename: req.params.filename
      });
      return errorResponse(res, error);
    }
  }
};

module.exports = fileController; 
