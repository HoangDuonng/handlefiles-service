const Tour = require('../models/tour.model');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const AdmZip = require('adm-zip');
const logger = require('../middlewares/logger');
const { 
  ensureDirectoryExists, 
  deleteFile, 
  deleteDirectory 
} = require('../utils/fileHandler');
const { 
  successResponse, 
  errorResponse, 
  notFoundResponse 
} = require('../utils/responseHandler');
const { validateRequired, validateLength } = require('../utils/validator');
const { createError, handleMongoError } = require('../utils/errorHandler');

// Đảm bảo FILE_STORAGE_ROOT luôn có giá trị
const FILE_STORAGE_ROOT = process.env.FILE_STORAGE_ROOT || path.join(process.cwd(), 'file_storage_root');

const tourController = {
  // Upload và xử lý tour ZIP
  uploadTour: async (req, res) => {
    try {
      if (!req.file) {
        logger.warn('Upload attempt without file');
        return errorResponse(res, { message: 'Không có file được upload' }, 400);
      }

      // Validate required fields
      validateRequired(req.body, ['title']);
      validateLength(req.body.title, 3, 100);

      const { title, description, tags } = req.body;
      const tourId = req.body.tourId || uuidv4();
      const zipFile = req.file;

      logger.info('Processing tour upload', {
        tourId,
        originalFilename: zipFile.originalname,
        size: zipFile.size
      });

      // Tạo thư mục cho tour
      const storageSubPath = `tours/${tourId}`;
      const tourDir = path.join(FILE_STORAGE_ROOT, storageSubPath);
      
      // Xóa thư mục cũ nếu tồn tại
      try {
        await deleteDirectory(tourDir);
      } catch (error) {
        logger.warn('Failed to delete existing tour directory', {
          tourId,
          error: error.message
        });
      }

      // Tạo thư mục mới
      await ensureDirectoryExists(tourDir);

      // Giải nén file ZIP với xử lý lỗi
      try {
        const zip = new AdmZip(zipFile.path);
        
        // Kiểm tra tính hợp lệ của file ZIP
        const entries = zip.getEntries();
        if (!entries.length) {
          throw createError('File ZIP không hợp lệ hoặc trống', 400);
        }

        logger.info('ZIP file entries', {
          tourId,
          entryCount: entries.length,
          entries: entries.map(entry => entry.entryName)
        });

        // Giải nén với xử lý lỗi
        zip.extractAllTo(tourDir, true);

        // Đọc danh sách file/folder sau khi giải nén
        let files = await fs.readdir(tourDir);
        logger.info('Files after extraction', {
          tourId,
          files
        });

        // Nếu chỉ có 1 thư mục con, chuyển vào thư mục đó
        let realTourDir = tourDir;
        let realStorageSubPath = storageSubPath;
        if (files.length === 1) {
          const firstItem = files[0];
          const firstItemPath = path.join(tourDir, firstItem);
          const stat = await fs.stat(firstItemPath);
          if (stat.isDirectory()) {
            realTourDir = firstItemPath;
            realStorageSubPath = path.join(storageSubPath, firstItem);
            files = await fs.readdir(realTourDir);
            logger.info('Detected single root folder, using as tour root', {
              tourId,
              realTourDir,
              files
            });
          }
        }

        // Kiểm tra các thư mục quan trọng
        const requiredDirs = ['panos', 'plugins'];
        for (const dir of requiredDirs) {
          const dirPath = path.join(realTourDir, dir);
          try {
            await fs.access(dirPath);
            logger.info(`Directory exists: ${dir}`, { tourId, dir });
          } catch (error) {
            logger.warn(`Required directory missing: ${dir}`, { tourId, dir });
          }
        }

        // Tìm file XML chính
        const mainXmlFile = files.find(file => file.toLowerCase().endsWith('.xml'));
        if (!mainXmlFile) {
          throw createError('Không tìm thấy file XML chính trong tour', 400);
        }

        logger.info('Tour files extracted successfully', {
          tourId,
          fileCount: files.length,
          mainXmlFile
        });

        // Tạo record trong database
        const safeStorageSubPath = realStorageSubPath.replace(/\\\\/g, '/').replace(/\\/g, '/');
        const tour = new Tour({
          tourId,
          title,
          description,
          originalZipFilename: zipFile.originalname,
          status: 'active',
          storageSubPath: safeStorageSubPath,
          mainXmlFile,
          accessUrlPrefix: `/static_files/${safeStorageSubPath}`,
          tags: tags ? tags.split(',') : [],
          fileCount: files.length,
          totalSize: zipFile.size
        });

        await tour.save();

        // Xóa file ZIP tạm
        await deleteFile(zipFile.path);

        logger.info('Tour uploaded successfully', {
          tourId,
          title,
          fileCount: files.length
        });

        return successResponse(res, tour, 'Tour đã được upload thành công');
      } catch (zipError) {
        logger.error('Error processing ZIP file', {
          tourId,
          error: zipError.message,
          stack: zipError.stack
        });
        // Xóa thư mục tour nếu có lỗi
        await deleteDirectory(tourDir);
        throw zipError;
      }
    } catch (error) {
      logger.error('Tour upload failed', {
        error: error.message,
        stack: error.stack,
        originalFilename: req.file?.originalname
      });
      
      // Xóa file tạm nếu có
      if (req.file) {
        try {
          await deleteFile(req.file.path);
        } catch (unlinkError) {
          logger.error('Failed to delete temporary file', {
            error: unlinkError.message,
            path: req.file.path
          });
        }
      }

      return errorResponse(res, error);
    }
  },

  // Lấy danh sách tours
  getTours: async (req, res) => {
    try {
      const { status, tag } = req.query;
      const query = {};

      if (status) query.status = status;
      if (tag) query.tags = tag;

      logger.info('Fetching tours list', { filters: query });

      const tours = await Tour.find(query);
      return successResponse(res, tours);
    } catch (error) {
      logger.error('Failed to fetch tours list', {
        error: error.message,
        stack: error.stack,
        filters: req.query
      });
      return errorResponse(res, error);
    }
  },

  // Lấy thông tin một tour
  getTour: async (req, res) => {
    try {
      const { tourId } = req.params;
      logger.info('Fetching tour details', { tourId });

      const tour = await Tour.findOne({ tourId });

      if (!tour) {
        logger.warn('Tour not found', { tourId });
        return notFoundResponse(res, 'Không tìm thấy tour');
      }

      return successResponse(res, tour);
    } catch (error) {
      logger.error('Failed to fetch tour details', {
        error: error.message,
        stack: error.stack,
        tourId: req.params.tourId
      });
      return errorResponse(res, error);
    }
  },

  // Cập nhật thông tin tour
  updateTour: async (req, res) => {
    try {
      const { tourId } = req.params;
      const updateData = req.body;

      logger.info('Updating tour', {
        tourId,
        updateData
      });

      const tour = await Tour.findOneAndUpdate(
        { tourId },
        updateData,
        { new: true, runValidators: true }
      );

      if (!tour) {
        logger.warn('Tour not found for update', { tourId });
        return notFoundResponse(res, 'Không tìm thấy tour');
      }

      logger.info('Tour updated successfully', {
        tourId,
        updatedFields: Object.keys(updateData)
      });

      return successResponse(res, tour, 'Tour đã được cập nhật');
    } catch (error) {
      logger.error('Failed to update tour', {
        error: error.message,
        stack: error.stack,
        tourId: req.params.tourId
      });
      return errorResponse(res, handleMongoError(error));
    }
  },

  // Xóa tour
  deleteTour: async (req, res) => {
    try {
      const { tourId } = req.params;
      logger.info('Deleting tour', { tourId });

      const tour = await Tour.findOne({ tourId });

      if (!tour) {
        logger.warn('Tour not found for deletion', { tourId });
        return notFoundResponse(res, 'Không tìm thấy tour');
      }

      // Xóa thư mục tour
      const tourDir = path.join(FILE_STORAGE_ROOT, tour.storageSubPath);
      await deleteDirectory(tourDir);

      // Xóa record trong database
      await tour.deleteOne();

      logger.info('Tour deleted successfully', {
        tourId,
        storagePath: tour.storageSubPath
      });

      return successResponse(res, null, 'Tour đã được xóa thành công');
    } catch (error) {
      logger.error('Failed to delete tour', {
        error: error.message,
        stack: error.stack,
        tourId: req.params.tourId
      });
      return errorResponse(res, error);
    }
  },

  getTourXml: async (req, res) => {
    try {
      const { tourId } = req.params;
      const tour = await Tour.findOne({ tourId });
      if (!tour) return res.status(404).send('Tour not found');

      // Đường dẫn file XML gốc
      const xmlPath = path.join(process.env.FILE_STORAGE_ROOT, tour.storageSubPath, 'tour.xml');
      let xml = await fs.readFile(xmlPath, 'utf8');

      const baseUrl = `${req.protocol}://${req.get('host')}/static_files/${tour.storageSubPath}`;
      const apiBase = `${req.protocol}://${req.get('host')}/api/tours/${tourId}/xmlfile?path=`;

      // Rewrite url, thumburl, preview (nếu là file .xml thì dùng API động, ngược lại static)
      xml = xml.replace(
        /(url|thumburl|preview)="([^"]+)"/g,
        (match, attr, value) => {
          if (/^https?:\/\//.test(value) || value.startsWith('/api/tours/')) {
            return `${attr}="${value}"`;
          }
          let cleanValue = value.replace(/^\/?(%SWFPATH%|%CURRENTXML%)\/?/, '');
          if (/\.xml$/i.test(cleanValue)) {
            return `${attr}="${apiBase}${encodeURIComponent(cleanValue)}"`;
          } else if (/^(panos|skin|plugins|audio)\//.test(cleanValue)) {
            return `${attr}="${baseUrl}/${cleanValue}"`;
          } else {
            return `${attr}="${value}"`;
          }
        }
      );

      // Rewrite <include url="..."> (luôn dùng API động nếu là .xml)
      xml = xml.replace(
        /<include\s+url="([^"]+)"/g,
        (match, value) => {
          if (/^https?:\/\//.test(value) || value.startsWith('/api/tours/')) {
            return `<include url="${value}"`;
          }
          let cleanValue = value.replace(/^\/?(%SWFPATH%|%CURRENTXML%)\/?/, '');
          if (/\.xml$/i.test(cleanValue)) {
            return `<include url="${apiBase}${encodeURIComponent(cleanValue)}"`;
          } else if (/^(panos|skin|plugins|audio)\//.test(cleanValue)) {
            return `<include url="${baseUrl}/${cleanValue}"`;
          } else {
            return `<include url="${value}"`;
          }
        }
      );

      // Rewrite <plugin ... url="..."> (nếu là .xml thì API động, còn lại static)
      xml = xml.replace(
        /<plugin([^>]*)url="([^"]+)"/g,
        (match, attrs, value) => {
          if (/^https?:\/\//.test(value) || value.startsWith('/api/tours/')) {
            return `<plugin${attrs}url="${value}"`;
          }
          let cleanValue = value.replace(/^\/?(%SWFPATH%|%CURRENTXML%)\/?/, '');
          if (/\.xml$/i.test(cleanValue)) {
            return `<plugin${attrs}url="${apiBase}${encodeURIComponent(cleanValue)}"`;
          } else if (/^(panos|skin|plugins|audio)\//.test(cleanValue)) {
            return `<plugin${attrs}url="${baseUrl}/${cleanValue}"`;
          } else {
            return `<plugin${attrs}url="${value}"`;
          }
        }
      );

      res.set('Content-Type', 'application/xml');
      res.send(xml);
    } catch (err) {
      res.status(500).send('Error reading or rewriting XML');
    }
  },

  getTourXmlFile: async (req, res) => {
    try {
      const { tourId } = req.params;
      const { path: xmlPathParam } = req.query;
      if (!xmlPathParam) return res.status(400).send('Missing path param');
      const tour = await Tour.findOne({ tourId });
      if (!tour) return res.status(404).send('Tour not found');

      const xmlFilePath = path.join(process.env.FILE_STORAGE_ROOT, tour.storageSubPath, xmlPathParam);
      let xml = await fs.readFile(xmlFilePath, 'utf8');

      const baseUrl = `${req.protocol}://${req.get('host')}/static_files/${tour.storageSubPath}`;
      const apiBase = `${req.protocol}://${req.get('host')}/api/tours/${tourId}/xmlfile?path=`;

      const xmlDir = path.dirname(xmlPathParam); // thư mục chứa file XML phụ

      xml = xml.replace(
        /(design_skin_images|design_bgimage|design_thumbborder_image|design_\\w+)=["']([^\"']+)["']/g,
        (match, attr, value) => {
          if (/^https?:\/\//.test(value) || value.startsWith('/api/tours/')) {
            return `${attr}="${value}"`;
          }
          if (/\\.(png|jpg|jpeg|gif|svg)$/i.test(value)) {
            // Nếu value đã có path (có /), giữ nguyên, nếu không thì nối với xmlDir
            const resourcePath = value.includes('/') ? value : (xmlDir ? xmlDir + '/' + value : value);
            return `${attr}="${baseUrl}/${resourcePath}"`;
          }
          return match;
        }
      );

      xml = xml.replace(
        /(url|thumburl|preview)="([^"]+)"/g,
        (match, attr, value) => {
          if (/^https?:\/\//.test(value) || value.startsWith('/api/tours/')) {
            return `${attr}="${value}"`;
          }
          let cleanValue = value.replace(/^\/?(%SWFPATH%|%CURRENTXML%)\/?/, '');
          if (/\.xml$/i.test(cleanValue)) {
            return `${attr}="${apiBase}${encodeURIComponent(cleanValue)}"`;
          } else if (/^(panos|skin|plugins|audio)\//.test(cleanValue)) {
            return `${attr}="${baseUrl}/${cleanValue}"`;
          } else {
            return `${attr}="${value}"`;
          }
        }
      );

      xml = xml.replace(
        /<include\s+url="([^"]+)"/g,
        (match, value) => {
          if (/^https?:\/\//.test(value) || value.startsWith('/api/tours/')) {
            return `<include url="${value}"`;
          }
          let cleanValue = value.replace(/^\/?(%SWFPATH%|%CURRENTXML%)\/?/, '');
          if (/\.xml$/i.test(cleanValue)) {
            return `<include url="${apiBase}${encodeURIComponent(cleanValue)}"`;
          } else if (/^(panos|skin|plugins|audio)\//.test(cleanValue)) {
            return `<include url="${baseUrl}/${cleanValue}"`;
          } else {
            return `<include url="${value}"`;
          }
        }
      );

      xml = xml.replace(
        /<plugin([^>]*)url="([^"]+)"/g,
        (match, attrs, value) => {
          if (/^https?:\/\//.test(value) || value.startsWith('/api/tours/')) {
            return `<plugin${attrs}url="${value}"`;
          }
          let cleanValue = value.replace(/^\/?(%SWFPATH%|%CURRENTXML%)\/?/, '');
          if (/\.xml$/i.test(cleanValue)) {
            return `<plugin${attrs}url="${apiBase}${encodeURIComponent(cleanValue)}"`;
          } else if (/^(panos|skin|plugins|audio)\//.test(cleanValue)) {
            return `<plugin${attrs}url="${baseUrl}/${cleanValue}"`;
          } else {
            return `<plugin${attrs}url="${value}"`;
          }
        }
      );

      res.set('Content-Type', 'application/xml');
      res.send(xml);
    } catch (err) {
      res.status(500).send('Error reading or rewriting XML');
    }
  }
};

module.exports = tourController; 
