// for /cloud

// 全頁驗證機制
const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth.middleware');

// 上傳檔案
const fs = require('fs');
const path = require('path');

const { upload, autoCleanupTmp } = require('../../config/multer.config');
const { baseDir } = require('./pathConfig');

const { format } = require('date-fns');


// 上傳檔案
router.post('/api/cloud/user/upload', authMiddleware(7), upload.single('file'), autoCleanupTmp, async (req, res) => {

    const { parent } = req.body;

    if (!req.file) return res.send({ type: 'error', message: '檔案不可為空。' });

    try {

        // 檢查父資料夾
        if (parent) {

            const parentFolder = await cloudModel.findOne({ token: parent, type: 'folder' });

            if (!parentFolder) return res.send({ type: 'error', message: '上層資料夾不存在。' });

        }

        // Cloud 實際儲存位置
        const uploadDir = path.join(baseDir, 'asmc');

        await fs.promises.mkdir(uploadDir, { recursive: true });

        // multer 已經產生好的檔名
        const fileName = req.file.filename;
        const filePath = path.join(uploadDir, fileName);

        // tmp → baseDir/asmc
        await fs.promises.rename(req.file.path, filePath);

        try {

            const file = new cloudModel({

                token: uuidv4(),

                name: req.file.originalname,

                type: 'file',

                parent: parent || null,

                owner: req.user.token,

                file: {
                    path: filePath,
                    size: req.file.size,
                    mimeType: req.file.mimetype
                },

                createTime: format(new Date(), 'yyyy-MM-dd HH:mm:ss')

            });

            await file.save();

            return res.send({
                type: 'success',
                data: file,
                message: '檔案上傳成功。'
            });

        } catch (e) {

            // MongoDB 儲存失敗，刪除已搬移的實體檔案
            try {
                await fs.promises.unlink(filePath);
            } catch {}

            throw e;

        }

    } catch (e) {

        console.log(e);

        return res.send({
            type: 'error',
            message: '伺服器錯誤，請洽客服人員協助。'
        });

    }

});


// 獲取 Cloud 資料
router.post('/api/cloud/user/getData', authMiddleware(7), async (req, res) => {

    const { parent } = req.body;

    try {

        const cloud = await cloudModel.find({ parent: parent || null }).lean();

        return res.send({
            type: 'success',
            data: cloud,
            message: 'Cloud 資料獲取成功！'
        });

    } catch (e) {

        console.log(e);

        return res.send({
            type: 'error',
            data: [],
            message: '伺服器錯誤，請洽客服人員協助。'
        });

    }

});


// 建立資料夾   
router.post('/api/cloud/user/createFolder', authMiddleware(7), async (req, res) => {

    const { name, parent } = req.body;

    if (!name) return res.send({ type: 'error', message: '資料夾名稱不可為空。' });

    try {

        // 檢查父資料夾
        if (parent) {

            const parentFolder = await cloudModel.findOne({ token: parent, type: 'folder' });

            if (!parentFolder) return res.send({ type: 'error', message: '上層資料夾不存在。' });

        }

        // 檢查同一層是否重名
        const existingFolder = await cloudModel.findOne({
            parent: parent || null,
            name,
            type: 'folder'
        });

        if (existingFolder) return res.send({ type: 'error', message: '資料夾已存在。' });

        const folder = new cloudModel({

            token: uuidv4(),

            name,

            type: 'folder',

            parent: parent || null,

            owner: req.user.token,

            createTime: format(new Date(), 'yyyy-MM-dd HH:mm:ss')

        });

        await folder.save();

        return res.send({
            type: 'success',
            data: folder,
            message: '資料夾建立成功。'
        });

    } catch (e) {

        console.log(e);

        return res.send({
            type: 'error',
            message: '伺服器錯誤，請洽客服人員協助。'
        });

    }

});


// 修改 Cloud 名稱
router.put('/api/cloud/user/revise', authMiddleware(7), async (req, res) => {

    const { targetCloud, name } = req.body;

    if (!targetCloud || !name) return res.send({ type: 'error', message: '修改資料不可為空。' });

    try {

        const cloud = await cloudModel.findOne({ token: targetCloud });

        if (!cloud) return res.send({ type: 'error', message: '檔案或資料夾不存在。' });

        // 檢查同一層是否重名
        const existingCloud = await cloudModel.findOne({
            token: { $ne: targetCloud },
            parent: cloud.parent,
            name
        });

        if (existingCloud) return res.send({ type: 'error', message: '同一資料夾下已有相同名稱。' });

        cloud.name = name;
        cloud.updateTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss');

        await cloud.save();

        return res.send({
            type: 'success',
            message: '名稱修改成功。'
        });

    } catch (e) {

        console.log(e);

        return res.send({
            type: 'error',
            message: '伺服器錯誤，請洽客服人員協助。'
        });

    }

});


// 移動 Cloud
router.put('/api/cloud/user/move', authMiddleware(7), async (req, res) => {

    const { targetCloud, parent } = req.body;

    if (!targetCloud) return res.send({ type: 'error', message: '資料不可為空。' });

    try {

        const cloud = await cloudModel.findOne({ token: targetCloud });

        if (!cloud) return res.send({ type: 'error', message: '檔案或資料夾不存在。' });

        // 移動到根目錄
        if (!parent) {

            cloud.parent = null;

        } else {

            // 防止移動到自己
            if (parent === targetCloud) return res.send({ type: 'error', message: '無法將資料夾移動至自己。' });

            // 確認目標資料夾存在
            const parentFolder = await cloudModel.findOne({
                token: parent,
                type: 'folder'
            });

            if (!parentFolder) return res.send({ type: 'error', message: '目標資料夾不存在。' });

            // 防止資料夾移動到自己的子資料夾
            if (cloud.type === 'folder') {

                let currentParent = parent;

                while (currentParent) {

                    if (currentParent === targetCloud) {
                        return res.send({
                            type: 'error',
                            message: '無法將資料夾移動至自己的子資料夾。'
                        });
                    }

                    const currentFolder = await cloudModel.findOne({
                        token: currentParent,
                        type: 'folder'
                    }).select('parent').lean();

                    if (!currentFolder) break;

                    currentParent = currentFolder.parent;

                }

            }

            // 檢查目標資料夾是否有相同名稱
            const existingCloud = await cloudModel.findOne({
                token: { $ne: targetCloud },
                parent,
                name: cloud.name
            });

            if (existingCloud) return res.send({ type: 'error', message: '目標資料夾下已有相同名稱。' });

            cloud.parent = parent;

        }

        cloud.updateTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss');

        await cloud.save();

        return res.send({
            type: 'success',
            message: '移動成功。'
        });

    } catch (e) {

        console.log(e);

        return res.send({
            type: 'error',
            message: '伺服器錯誤，請洽客服人員協助。'
        });

    }

});


// 刪除 Cloud
router.delete('/api/cloud/user/delete', authMiddleware(7), async (req, res) => {

    const { targetCloud } = req.body;

    if (!targetCloud) return res.send({ type: 'error', message: '資料不可為空。' });

    try {

        const cloud = await cloudModel.findOne({ token: targetCloud });

        if (!cloud) return res.send({ type: 'error', message: '檔案或資料夾不存在。' });

        // 遞迴取得所有子項目
        const getChildren = async (parent) => {

            const children = await cloudModel.find({ parent }).lean();

            let items = [];

            for (const child of children) {

                items.push(child);

                // 如果是資料夾，繼續尋找底下的項目
                if (child.type === 'folder') {
                    items.push(...await getChildren(child.token));
                }

            }

            return items;
        };

        let deleteItems = [cloud];

        // 如果是資料夾，連同所有子項目一起刪除
        if (cloud.type === 'folder') {
            deleteItems.push(...await getChildren(targetCloud));
        }

        // 找出所有需要刪除的實體檔案
        const filePaths = deleteItems.filter((item) => item.type === 'file' && item.file?.path).map((item) => item.file.path);

        // 刪除 Cloud 資料
        await cloudModel.deleteMany({
            token: {
                $in: deleteItems.map((item) => item.token)
            }
        });

        // 刪除本地實體檔案
        await Promise.all(
            filePaths.map(async (filePath) => {

                try {

                    await fs.promises.unlink(filePath);

                } catch (e) {

                    // 檔案不存在時忽略
                    if (e.code !== 'ENOENT') {
                        console.log(`檔案刪除失敗：${filePath}`, e);
                    }

                }

            })
        );

        return res.send({ type: 'success',  message: '刪除成功。'});

    } catch (e) {

        console.log(e);

        return res.send({
            type: 'error',
            message: '伺服器錯誤，請洽客服人員協助。'
        });

    }

});


module.exports = router;