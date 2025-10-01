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
const { validateRequired, validateLength } = require('../utils/validator');
const { createError, handleMongoError } = require('../utils/errorHandler');

const FILE_STORAGE_ROOT = process.env.FILE_STORAGE_ROOT;

const tourService = {
  uploadTour: async (file, body) => {
    if (!file) throw { message: 'Không có file được upload', status: 400 };
    validateRequired(body, ['title']);
    validateLength(body.title, 3, 100);
    const { title, description, tags, type } = body;
    const tourId = body.tourId || uuidv4();
    const zipFile = file;
    const storageSubPath = `tours/${tourId}`;
    const tourDir = path.join(FILE_STORAGE_ROOT, storageSubPath);
    try {
      await deleteDirectory(tourDir);
    } catch (error) {}
    await ensureDirectoryExists(tourDir);
    try {
      const zip = new AdmZip(zipFile.path);
      const entries = zip.getEntries();
      if (!entries.length) throw createError('File ZIP không hợp lệ hoặc trống', 400);
      zip.extractAllTo(tourDir, true);
      let files = await fs.readdir(tourDir);
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
        }
      }
      const requiredDirs = ['panos', 'plugins'];
      for (const dir of requiredDirs) {
        const dirPath = path.join(realTourDir, dir);
        try { await fs.access(dirPath); } catch (error) {}
      }
      const mainXmlFile = files.find(file => file.toLowerCase().endsWith('.xml'));
      if (!mainXmlFile) throw createError('Không tìm thấy file XML chính trong tour', 400);
      const safeStorageSubPath = realStorageSubPath.replace(/\\/g, '/').replace(/\\/g, '/');
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
        totalSize: zipFile.size,
        type: type || 'explore_tour'
      });
      await tour.save();
      await deleteFile(zipFile.path);
      return tour;
    } catch (zipError) {
      await deleteDirectory(tourDir);
      throw zipError;
    }
  },

  getTours: async (query) => {
    const { status, tag } = query;
    const q = {};
    if (status) q.status = status;
    if (tag) q.tags = tag;
    const tours = await Tour.find(q);
    return tours;
  },

  getTour: async (params) => {
    const { tourId } = params;
    const tour = await Tour.findOne({ tourId });
    return tour;
  },

  updateTour: async (params, body) => {
    const { tourId } = params;
    const updateData = body;
    const tour = await Tour.findOneAndUpdate(
      { tourId },
      updateData,
      { new: true, runValidators: true }
    );
    return tour;
  },

  deleteTour: async (params) => {
    const { tourId } = params;
    const tour = await Tour.findOne({ tourId });
    if (!tour) throw { message: 'Không tìm thấy tour', status: 404 };
    const tourRootDir = path.join(FILE_STORAGE_ROOT, 'tours', tourId);
    await deleteDirectory(tourRootDir);
    await tour.deleteOne();
    return true;
  },

  getTourXml: async (params, req) => {
    const { tourId } = params;
    const tour = await Tour.findOne({ tourId });
    if (!tour) throw { message: 'Tour not found', status: 404 };
    const xmlPath = path.join(process.env.FILE_STORAGE_ROOT, tour.storageSubPath, 'tour.xml');
    let xml = await fs.readFile(xmlPath, 'utf8');
    const baseUrl = `${req.protocol}://${req.get('host')}/static_files/${tour.storageSubPath}`;
    const apiBase = `${req.protocol}://${req.get('host')}/api/handlefile/tours/${tourId}/xmlfile?path=`;
    xml = xml.replace(
      /(url|thumburl|preview)="([^"]+)"/g,
      (match, attr, value) => {
        if (/^https?:\/\//.test(value) || value.startsWith('/api/handlefile/tours/')) return `${attr}="${value}"`;
        let cleanValue = value.replace(/^\/?(%SWFPATH%|%CURRENTXML%)\/?/, '');
        if (/\.xml$/i.test(cleanValue)) return `${attr}="${apiBase}${encodeURIComponent(cleanValue)}"`;
        else if (/^(panos|skin|plugins|audio)\//.test(cleanValue)) return `${attr}="${baseUrl}/${cleanValue}"`;
        else return `${attr}="${value}"`;
      }
    );
    xml = xml.replace(
      /<include\s+url="([^"]+)"/g,
      (match, value) => {
        if (/^https?:\/\//.test(value) || value.startsWith('/api/handlefile/tours/')) return `<include url="${value}"`;
        let cleanValue = value.replace(/^\/?(%SWFPATH%|%CURRENTXML%)\/?/, '');
        if (/\.xml$/i.test(cleanValue)) return `<include url="${apiBase}${encodeURIComponent(cleanValue)}"`;
        else if (/^(panos|skin|plugins|audio)\//.test(cleanValue)) return `<include url="${baseUrl}/${cleanValue}"`;
        else return `<include url="${value}"`;
      }
    );
    xml = xml.replace(
      /<plugin([^>]*)url="([^"]+)"/g,
      (match, attrs, value) => {
        if (/^https?:\/\//.test(value) || value.startsWith('/api/handlefile/tours/')) return `<plugin${attrs}url="${value}"`;
        let cleanValue = value.replace(/^\/?(%SWFPATH%|%CURRENTXML%)\/?/, '');
        if (/\.xml$/i.test(cleanValue)) return `<plugin${attrs}url="${apiBase}${encodeURIComponent(cleanValue)}"`;
        else if (/^(panos|skin|plugins|audio)\//.test(cleanValue)) return `<plugin${attrs}url="${baseUrl}/${cleanValue}"`;
        else return `<plugin${attrs}url="${value}"`;
      }
    );
    return xml;
  },

  getTourXmlFile: async (params, query, req) => {
    const { tourId } = params;
    const { path: xmlPathParam } = query;
    if (!xmlPathParam) throw { message: 'Missing path param', status: 400 };
    const tour = await Tour.findOne({ tourId });
    if (!tour) throw { message: 'Tour not found', status: 404 };
    const xmlFilePath = path.join(process.env.FILE_STORAGE_ROOT, tour.storageSubPath, xmlPathParam);
    let xml = await fs.readFile(xmlFilePath, 'utf8');
    const baseUrl = `${req.protocol}://${req.get('host')}/static_files/${tour.storageSubPath}`;
    const apiBase = `${req.protocol}://${req.get('host')}/api/handlefile/tours/${tourId}/xmlfile?path=`;
    const xmlDir = path.dirname(xmlPathParam);
    xml = xml.replace(
      /(design_skin_images|design_bgimage|design_thumbborder_image|design_\w+)=\"([^\"']+)\"/g,
      (match, attr, value) => {
        if (/^https?:\/\//.test(value) || value.startsWith('/api/handlefile/tours/')) return `${attr}="${value}"`;
        if (/\.(png|jpg|jpeg|gif|svg)$/i.test(value)) {
          const resourcePath = value.includes('/') ? value : (xmlDir ? xmlDir + '/' + value : value);
          return `${attr}="${baseUrl}/${resourcePath}"`;
        }
        return match;
      }
    );
    xml = xml.replace(
      /(url|thumburl|preview)="([^"]+)"/g,
      (match, attr, value) => {
        if (/^https?:\/\//.test(value) || value.startsWith('/api/handlefile/tours/')) return `${attr}="${value}"`;
        let cleanValue = value.replace(/^\/?(%SWFPATH%|%CURRENTXML%)\/?/, '');
        if (/\.xml$/i.test(cleanValue)) return `${attr}="${apiBase}${encodeURIComponent(cleanValue)}"`;
        else if (/^(panos|skin|plugins|audio)\//.test(cleanValue)) return `${attr}="${baseUrl}/${cleanValue}"`;
        else return `${attr}="${value}"`;
      }
    );
    xml = xml.replace(
      /<include\s+url="([^"]+)"/g,
      (match, value) => {
        if (/^https?:\/\//.test(value) || value.startsWith('/api/handlefile/tours/')) return `<include url="${value}"`;
        let cleanValue = value.replace(/^\/?(%SWFPATH%|%CURRENTXML%)\/?/, '');
        if (/\.xml$/i.test(cleanValue)) return `<include url="${apiBase}${encodeURIComponent(cleanValue)}"`;
        else if (/^(panos|skin|plugins|audio)\//.test(cleanValue)) return `<include url="${baseUrl}/${cleanValue}"`;
        else return `<include url="${value}"`;
      }
    );
    xml = xml.replace(
      /<plugin([^>]*)url="([^"]+)"/g,
      (match, attrs, value) => {
        if (/^https?:\/\//.test(value) || value.startsWith('/api/handlefile/tours/')) return `<plugin${attrs}url="${value}"`;
        let cleanValue = value.replace(/^\/?(%SWFPATH%|%CURRENTXML%)\/?/, '');
        if (/\.xml$/i.test(cleanValue)) return `<plugin${attrs}url="${apiBase}${encodeURIComponent(cleanValue)}"`;
        else if (/^(panos|skin|plugins|audio)\//.test(cleanValue)) return `<plugin${attrs}url="${baseUrl}/${cleanValue}"`;
        else return `<plugin${attrs}url="${value}"`;
      }
    );
    return xml;
  },

  // Lấy danh sách tour theo type
  getToursByType: async (type) => {
    if (!type) throw { message: 'Thiếu type', status: 400 };
    const tours = await Tour.find({ type });
    return tours;
  }
};

module.exports = tourService; 
