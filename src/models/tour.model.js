const mongoose = require('mongoose');

const tourSchema = new mongoose.Schema({
  tourId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  originalZipFilename: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'processing', 'error'],
    default: 'active'
  },
  storageSubPath: {
    type: String,
    required: true,
    trim: true
  },
  mainXmlFile: {
    type: String,
    required: true,
    trim: true
  },
  accessUrlPrefix: {
    type: String,
    required: true,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  uploadedBy: {
    type: String,
    trim: true
  },
  fileCount: {
    type: Number,
    default: 0
  },
  totalSize: {
    type: Number,
    default: 0
  },
  customMetadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true // This will add createdAt and updatedAt fields
});

// Create indexes
tourSchema.index({ status: 1 });
tourSchema.index({ tags: 1 });
tourSchema.index({ uploadedBy: 1 });

// Add a method to get the full storage path
tourSchema.methods.getFullStoragePath = function() {
  return `${process.env.FILE_STORAGE_ROOT}/${this.storageSubPath}`;
};

// Add a method to get the full access URL
tourSchema.methods.getFullAccessUrl = function() {
  return `${process.env.API_BASE_URL || ''}${this.accessUrlPrefix}`;
};

const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour; 
