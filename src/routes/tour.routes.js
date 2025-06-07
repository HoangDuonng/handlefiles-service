const express = require('express');
const router = express.Router();
const tourController = require('../controllers/tour.controller');
const upload = require('../middlewares/tourUpload');

// Upload tour (ZIP file)
router.post('/upload', upload.single('tour'), tourController.uploadTour);

// Lấy danh sách tours
router.get('/', tourController.getTours);

// Lấy thông tin một tour
router.get('/:tourId', tourController.getTour);

// Cập nhật thông tin tour
router.put('/:tourId', tourController.updateTour);

// Xóa tour
router.delete('/:tourId', tourController.deleteTour);

router.get('/:tourId/xml', tourController.getTourXml);

router.get('/:tourId/xmlfile', tourController.getTourXmlFile);

module.exports = router; 
