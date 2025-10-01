const tourRoutes = require('../routes/tour.routes');
const fileRoutes = require('./file.routes');

const setupRoutes = (app) => {
  app.use('/api/tours', tourRoutes);
  app.use('/api/files', fileRoutes);
};

module.exports = setupRoutes; 
