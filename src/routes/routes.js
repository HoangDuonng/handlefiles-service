const tourRoutes = require('../routes/tour.routes');
const fileRoutes = require('./file.routes');

const setupRoutes = (app) => {
  app.use('/api/handlefile/tours', tourRoutes);
  app.use('/api/handlefile/files', fileRoutes);
};

module.exports = setupRoutes; 
