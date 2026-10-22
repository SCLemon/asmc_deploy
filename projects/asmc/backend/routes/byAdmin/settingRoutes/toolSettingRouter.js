// for /tool-setting

// 全頁驗證機制
const express = require('express');
const router = express.Router();

const userModel = require('../../../models/userModel');
const cloudModel = require('../../../models/cloudModel');
const toolModel = require('../../../models/toolModel');

const { v4: uuidv4 } = require('uuid');

const authMiddleware = require('../../../middleware/auth.middleware');


const { createFolder, deleteCloudItem } = require('../../../utils/cloudService')
const fs = require('fs');
const path = require('path');
const { upload, autoCleanupTmp } = require('../../../config/multer.config');
const { baseDir } = require('../../../config/pathConfig');
const { format } = require('date-fns');

// 獲取資料 For Setting -- ok
router.get('/api/toolSetting/admin/getData', authMiddleware(10), async (req, res) => {
    try {

        const tools = await toolModel.find({}).lean();

        const output = tools.map((tool) => {
            return {
                token: tool.token,
                name: tool.name,
                version: tool.version,
                status: tool.status,
                author: tool.author || '-',
            };
        }).reverse();

        return res.send({
            type: 'success',
            data: output,
            message: '資料獲取成功！'
        });

    } catch (e) {
        console.error(e);
        return res.status(500).send({
            type: 'error',
            message: '伺服器錯誤，請洽客服人員協助。'
        });
    }
});

// 獲取特定工具資料 -- ok
router.post('/api/toolSetting/admin/getSpecificData', authMiddleware(10), async (req, res) => {

    const { targetTool } = req.body;


    try {

        const tool = await toolModel.findOne({ token: targetTool });
        if(!tool){
            return res.send({
                type:'success',
                data: {},
                message:'工具資料不存在。'
            });
        }


        const output = {
            name: tool.name,
            author: tool.author,
            version: tool.version,
            status: tool.status,
            abstract: tool.abstract,
            imgUrl: tool.iconToken ? `/api/cloud/user/download/${tool.iconToken}`: null,
        }

        return res.send({
            type:'success',
            data: output,
            message:'工具資料獲取成功！'
        });
        
    } catch (e) {
        console.log(e)
        return res.send({
            type:'error',
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }
});

// 新增工具 -- ok
router.post('/api/toolSetting/admin/register', authMiddleware(10), async (req, res) => {

    const token =  uuidv4();
    let { name, version, abstract, author } = req.body;

    if (!name) {
        return res.send({
            type:'error',
            message:'註冊名稱不可為空。'
        });
    }

    try {
        
        const newTool = new toolModel({ token, name, author, abstract, version });

        await newTool.save();


        // 創建雲端空間
        let rootFolder = await cloudModel.findOne({
            name: '分析工具',
            type: 'folder',
            parent: null,
            owner: 'System'
        });

        if (!rootFolder) {
            const rootRes = await createFolder({
                name: '分析工具',
                parent: null,
                owner: 'System'
            });
            rootFolder = rootRes.data;
        }

        await createFolder({
            token,
            name: `${name} ${version || '@Latest'}`,
            parent: rootFolder.token,
            owner: req.user.token
        });

        return res.send({
            type:'success',
            message:'工具註冊成功。' 
        });

    } catch (e) {
        console.log(e)
        return res.send({
            type:'error',
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }
});

// 修改工具 -- ok
router.post('/api/toolSetting/admin/revise', authMiddleware(10), async (req, res) => {

    let { targetTool, name, version, author, abstract } = req.body;

    if (!targetTool || !name) {
        return res.send({
            type:'error',
            message:'修改資料不可為空。'
        });
    }

    try {

        const tool = await toolModel.findOne({ token: targetTool });
        if(!tool){
            return res.send({
                type:'error',
                message:'工具資料不存在。'
            });
        }
        
        tool.name = name;
        tool.version = version;
        tool.author = author;
        tool.abstract = abstract;

        await tool.save();

        const cloud = await cloudModel.findOne({ token: targetTool });
        cloud.name = `${name} ${version || '@Latest'}`,
        await cloud.save();
        

        return res.send({
            type:'success',
            message:'工具資料修改成功。' 
        });

    } catch (e) {
        console.log(e)
        return res.send({
            type:'error',
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }
});

// 凍結工具 -- ok
router.put('/api/toolSetting/admin/freeze', authMiddleware(10), async (req, res) => {

    let { targetTool } = req.body;

    if (!targetTool) {
        return res.send({
            type:'error', message:'工具狀態修改失敗（資料為空）。'
        });
    }

    try {

        const existingTool = await toolModel.findOne({ token: targetTool });
        if (!existingTool) {
            return res.send({
                type:'error', message:'使用者狀態修改失敗（用戶不存在）。'
            });
        }

        existingTool.status = !existingTool.status;

        await existingTool.save();

        return res.send({
            type:'success', message:'工具狀態修改成功。' 
        });

    } catch (e) {
        console.log(e)
        return res.send({
            type:'error', message:'伺服器錯誤，請洽客服人員協助。'
        });
    }
});

// 刪除工具 -- ok
router.post('/api/toolSetting/admin/delete', authMiddleware(10), async (req, res) => {

    const { targetTool } = req.body;

    if (!targetTool) {
        return res.send({
            type: 'error',
            message: '工具刪除失敗（資料為空）。'
        });
    }

    try {
        const isAdmin = req.user.level == 10;

        const query = { token: targetTool };
        if (!isAdmin) query.owner = req.user.token;

        const tool = await toolModel.findOne(query);

        if (!tool) {
            return res.send({ 
                type: 'error', 
                message: '工具刪除失敗（實驗計畫不存在或無權限）。' 
            });
        }

        await toolModel.deleteOne({ token: targetTool });

        const deleteCloudUserToken = isAdmin ? req.user.token : record.owner;
        await deleteCloudItem(targetTool, deleteCloudUserToken);

        return res.send({ 
            type: 'success',  
            message: '工具及數據資料夾已刪除成功。' 
        });

    } catch (e) {
        console.log(e);
        return res.send({ 
            type: 'error', 
            message: '伺服器錯誤，請洽客服人員協助。' 
        });
    }
});

// 獲取資料 For View -- ok (Lv7)
router.get('/api/toolSetting/admin/getDataForView', authMiddleware(7), async (req, res) => {
    try {

        const tools = await toolModel.find({}).lean();

        const output = tools.filter(t => t.status).map((tool) => {
            return {
                token: tool.token,
                name: tool.name,
                version: tool.version,
                author: tool.author || '-',
                abstract: tool.abstract,
                imgUrl: tool.iconToken ? `/api/cloud/user/download/${tool.iconToken}`: null,
            };
        }).reverse();

        return res.send({
            type: 'success',
            data: output,
            message: '資料獲取成功！'
        });

    } catch (e) {
        console.error(e);
        return res.status(500).send({
            type: 'error',
            message: '伺服器錯誤，請洽客服人員協助。'
        });
    }
});

// 上傳 Icon 並以 iconToken 取代舊檔案
router.post('/api/toolSetting/admin/uploadIcon', authMiddleware(10), upload.single('file'), autoCleanupTmp, async (req, res) => {
    
    const { targetTool } = req.body;

    if (!req.file) {
        return res.send({
            type: 'error',
            message: '檔案不可為空。'
        });
    }

    try {
        // 1. 確認工具是否存在
        const tool = await toolModel.findOne({ token: targetTool });

        if (!tool) {
            return res.send({
                type: 'error',
                message: '工具不存在。'
            });
        }

        // 2. 移動新上傳的檔案到正式儲存路徑
        const uploadDir = path.join(baseDir, 'asmc');
        await fs.promises.mkdir(uploadDir, { recursive: true });

        const fileName = req.file.filename;
        const filePath = path.join(uploadDir, fileName);
        await fs.promises.rename(req.file.path, filePath);

        const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
        const newToken = uuidv4();

        try {
            // 3. 儲存新檔案至 cloudModel
            const newFile = new cloudModel({
                token: newToken,
                name: originalName,
                type: 'file',
                parent: targetTool,
                owner: req.user.token,
                file: {
                    path: filePath,
                    size: req.file.size,
                    mimeType: req.file.mimetype
                },
                createTime: format(new Date(), 'yyyy-MM-dd HH:mm:ss')
            });

            await newFile.save();

            if (tool.iconToken) {
                const oldFile = await cloudModel.findOne({ token: tool.iconToken });
                if (oldFile) {
                    if (oldFile.file?.path) {
                        try {
                            await fs.promises.unlink(oldFile.file.path);
                        } catch (err) {
                            console.warn('舊實體檔案不存在或刪除失敗：', err.message);
                        }
                    }
                    await cloudModel.deleteOne({ token: tool.iconToken });
                }
            }
            tool.iconToken = newToken;
            await tool.save();

            return res.send({
                type: 'success',
                data: {
                    imgUrl:`/api/cloud/user/download/${newToken}`
                },
                message: '工具圖示更新成功。'
            });

        } catch (e) {

            try {
                await fs.promises.unlink(filePath);
            } catch (unlinkError) {
                console.log('刪除實體檔案失敗：', unlinkError);
            }
            throw e;
        }

    } catch (e) {
        console.error(e);
        return res.send({
            type: 'error',
            message: '伺服器錯誤，請洽客服人員協助。'
        });
    }
});


module.exports = router;