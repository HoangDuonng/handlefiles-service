const path = require('path');
const fs = require('fs');

const setupStorage = () => {
  const fileStorageRoot = process.env.FILE_STORAGE_ROOT;
  const tempUploadsDir = process.env.TEMP_UPLOADS_DIR;

  const requiredDirs = [
    fileStorageRoot,
    path.join(fileStorageRoot, 'tours'),
    path.join(fileStorageRoot, 'user_avatars'),
    path.join(fileStorageRoot, 'product_images'),
    path.join(fileStorageRoot, 'general_documents'),
    tempUploadsDir
  ];

  requiredDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  return {
    fileStorageRoot,
    tempUploadsDir
  };
};

module.exports = setupStorage; 
