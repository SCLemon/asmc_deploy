const fs = require('fs');
const path = require('path')

const roomModel = require('../models/roomModel');

function getFolderSize(folderPath) {

    if(!fs.existsSync(folderPath)) return 0;

    let totalSize = 0;
    const files = fs.readdirSync(folderPath);
    files.forEach((file) => {
      const filePath = path.join(folderPath, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) totalSize += getFolderSize(filePath);
      else totalSize += stat.size;
    });
  
    return totalSize; // Bytes
}

const checkUsageMemory = async(req,res,next)=>{
    try{
      const room = await roomModel.findOne({ owners: req.headers['x-user-token'] });
      if(!room) return res.send({ type:'error', message:'查無此群組。'});


      const databaseUrl = room.database.url;
      const limitMemory = room.database.limit.memory / 1024; // MB
      
      // 1. 目前群組已用空間 (MB)
      const usedSizeMB = getFolderSize(databaseUrl) / (1024 * 1024); // MB

      // 2. 本次上傳檔案的大小 (MB)
      let uploadSizeMB = 0;
      if (req.files && req.files.attachments && req.files.attachments.length > 0) {
          uploadSizeMB = req.files.attachments.reduce((sum, file) => sum + file.size, 0) / (1024 * 1024);
      }

      const totalAfterUpload = usedSizeMB + uploadSizeMB;
      if (totalAfterUpload > limitMemory) {
          return res.send({
              type: 'error',
              message: `空間用量已超過限制 ${limitMemory} MB，如需調額請洽客服人員。`,
          });
      }
      next()
    }
    catch(e){
        console.error(e);
        return res.send({
            type: 'error',
            message: '伺服器錯誤，請洽客服人員協助。',
        });
    }
}


module.exports = { checkUsageMemory, getFolderSize }