const tourService = require('../services/tour.service');
const { successResponse, errorResponse, notFoundResponse } = require('../utils/responseHandler');

const tourController = {
  uploadTour: async (req, res) => {
    try {
      const result = await tourService.uploadTour(req.file, req.body);
      return successResponse(res, result, 'Tour đã được upload thành công');
    } catch (error) {
      return errorResponse(res, error);
    }
  },
  getTours: async (req, res) => {
    try {
      const result = await tourService.getTours(req.query);
      return successResponse(res, result);
    } catch (error) {
      return errorResponse(res, error);
    }
  },
  getTour: async (req, res) => {
    try {
      const result = await tourService.getTour(req.params);
      if (!result) return notFoundResponse(res, 'Không tìm thấy tour');
      return successResponse(res, result);
    } catch (error) {
      return errorResponse(res, error);
    }
  },
  updateTour: async (req, res) => {
    try {
      const result = await tourService.updateTour(req.params, req.body);
      if (!result) return notFoundResponse(res, 'Không tìm thấy tour');
      return successResponse(res, result, 'Tour đã được cập nhật');
    } catch (error) {
      return errorResponse(res, error);
    }
  },
  deleteTour: async (req, res) => {
    try {
      await tourService.deleteTour(req.params);
      return successResponse(res, null, 'Tour đã được xóa thành công');
    } catch (error) {
      return errorResponse(res, error);
    }
  },
  getTourXml: async (req, res) => {
    try {
      const xml = await tourService.getTourXml(req.params, req);
      res.set('Content-Type', 'application/xml');
      res.send(xml);
    } catch (error) {
      res.status(500).send('Error reading or rewriting XML');
    }
  },
  getTourXmlFile: async (req, res) => {
    try {
      const xml = await tourService.getTourXmlFile(req.params, req.query, req);
      res.set('Content-Type', 'application/xml');
      res.send(xml);
    } catch (error) {
      res.status(500).send('Error reading or rewriting XML');
    }
  },
  // Lấy danh sách tour theo type
  getToursByType: async (req, res) => {
    try {
      const { type } = req.params;
      const result = await tourService.getToursByType(type);
      return successResponse(res, result);
    } catch (error) {
      return errorResponse(res, error);
    }
  }
};

module.exports = tourController; 
