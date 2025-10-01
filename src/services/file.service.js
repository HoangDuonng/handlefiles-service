const path = require('path');
const fs = require('fs').promises;
const File = require('../models/file.model');
const {
  generateSafeFilename,
  ensureDirectoryExists,
  deleteFile,
  getFileInfo,
  deleteDirectory
} = require('../utils/fileHandler');
const { validateRequired } = require('../utils/validator');

const fileService = {
  uploadFile: async (file, body) => {
    if (!file) throw { message: 'No file uploaded', status: 400 };
    validateRequired(body, ['context']);
    const { context, entityId, type, position } = body;
    const fileStorageRoot = process.env.FILE_STORAGE_ROOT
      ? path.resolve(process.env.FILE_STORAGE_ROOT)
      : path.join(__dirname, '..', 'file_storage_root');
    const contextDir = path.join(fileStorageRoot, context);
    await ensureDirectoryExists(contextDir);
    const targetDir = entityId ? path.join(contextDir, entityId) : contextDir;
    await ensureDirectoryExists(targetDir);
    const newFilename = generateSafeFilename(file.originalname);
    const targetPath = path.join(targetDir, newFilename);
    await fs.rename(file.path, targetPath);
    const fileDoc = new File({
      filename: newFilename,
      originalName: file.originalname,
      path: targetPath,
      size: file.size,
      mimetype: file.mimetype,
      context,
      entityId,
      ...(type && { type }),
      ...(position && { position })
    });
    await fileDoc.save();
    return fileDoc;
  },

  uploadMultipleFiles: async (files, body) => {
    if (!files || files.length === 0) throw { message: 'No files uploaded', status: 400 };
    validateRequired(body, ['context']);
    const { context, entityId, type, position } = body;
    
    const fileStorageRoot = process.env.FILE_STORAGE_ROOT
      ? path.resolve(process.env.FILE_STORAGE_ROOT)
      : path.join(__dirname, '..', 'file_storage_root');
    const contextDir = path.join(fileStorageRoot, context);
    await ensureDirectoryExists(contextDir);
    const targetDir = entityId ? path.join(contextDir, entityId) : contextDir;
    await ensureDirectoryExists(targetDir);

    const uploadedFiles = [];
    
    for (const file of files) {
      const newFilename = generateSafeFilename(file.originalname);
      const targetPath = path.join(targetDir, newFilename);
      await fs.rename(file.path, targetPath);
      
      const fileDoc = new File({
        filename: newFilename,
        originalName: file.originalname,
        path: targetPath,
        size: file.size,
        mimetype: file.mimetype,
        context,
        entityId,
        ...(type && { type }),
        ...(position && { position })
      });
      await fileDoc.save();
      uploadedFiles.push(fileDoc);
    }
    
    return uploadedFiles;
  },

  deleteFile: async (params) => {
    const { context, filename, entityId } = params;
    const fileStorageRoot = process.env.FILE_STORAGE_ROOT
      ? path.resolve(process.env.FILE_STORAGE_ROOT)
      : path.join(__dirname, '..', 'file_storage_root');
    const filePath = entityId
      ? path.join(fileStorageRoot, context, entityId, filename)
      : path.join(fileStorageRoot, context, filename);
    try {
      await fs.access(filePath);
    } catch (error) {
      throw { message: 'File not found in storage', status: 404 };
    }
    const file = await File.findOne({
      context,
      filename,
      entityId: entityId || null
    });
    if (!file) {
      throw { message: 'File not found in database', status: 404 };
    }
    await deleteFile(filePath);
    await file.deleteOne();
    if (entityId) {
      const entityDir = path.join(fileStorageRoot, context, entityId);
      try {
        const files = await fs.readdir(entityDir);
        if (files.length === 0) {
          await deleteDirectory(entityDir);
        }
      } catch (dirError) {}
    }
    return true;
  },

  deleteFilesByEntity: async ({ context, entityId }) => {
    const files = await File.find({ context, entityId });
    for (const file of files) {
      try {
        await fs.unlink(file.path);
      } catch (e) {}
      await file.deleteOne();
    }
    // Xóa thư mục entity nếu rỗng
    const fileStorageRoot = process.env.FILE_STORAGE_ROOT
      ? path.resolve(process.env.FILE_STORAGE_ROOT)
      : path.join(__dirname, '..', 'file_storage_root');
    const entityDir = path.join(fileStorageRoot, context, entityId);
    try {
      const filesLeft = await fs.readdir(entityDir);
      if (filesLeft.length === 0) {
        await fs.rmdir(entityDir);
      }
    } catch (e) {}
    return true;
  },

  getFileInfo: async (params) => {
    const { context, filename, entityId } = params;
    const file = await File.findOne({
      context,
      filename,
      entityId: entityId || null
    });
    if (!file) {
      throw { message: 'File not found', status: 404 };
    }
    try {
      await fs.access(file.path);
    } catch (error) {
      throw { message: 'File not found in storage', status: 404 };
    }
    const fileInfo = await getFileInfo(file.path);
    return {
      ...file.toObject(),
      ...fileInfo
    };
  },

  getFileContent: async (params) => {
    const { context, filename, entityId } = params;
    const fileStorageRoot = process.env.FILE_STORAGE_ROOT
      ? path.resolve(process.env.FILE_STORAGE_ROOT)
      : path.join(__dirname, '..', 'file_storage_root');
    const filePath = entityId
      ? path.join(fileStorageRoot, context, entityId, filename)
      : path.join(fileStorageRoot, context, filename);

    const fsSync = require('fs');
    console.log('getFileContent:', filePath, fsSync.existsSync(filePath));
    if (!fsSync.existsSync(filePath)) {
      throw { status: 404, message: 'File not found' };
    }
    return filePath;
  }
};

module.exports = fileService; 
