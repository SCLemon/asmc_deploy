const multer = require('multer');
const path = require('path');
const fs = require('fs');


const { tmpDir } = require('./pathConfig');

// 建立 tmp dir
fs.mkdirSync(tmpDir, { recursive: true });


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tmpDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});


const upload = multer({
  storage,
});


function autoCleanupTmp(req, res, next) {

  let cleaned = false;

  const removeFile = async (file) => {
    if (!file?.destination || !file?.filename) return;

    const realPath = path.join(file.destination, file.filename);

    try {
      await fs.promises.unlink(realPath);
    } 
    catch {}

  };

  const cleanup = async () => {

    if (cleaned) return;
    cleaned = true;

    if (req.file) await removeFile(req.file);

    if (req.files) {
      const tasks = [];

      for (const files of Object.values(req.files)) {
        for (const file of files) {
          tasks.push(removeFile(file));
        }
      }

      await Promise.all(tasks);
    }

  };

  res.on('finish', cleanup);
  res.on('close', cleanup);

  next();
}


module.exports = {
  upload,
  autoCleanupTmp
};