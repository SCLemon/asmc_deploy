// for /cloud

// 全頁驗證機制
const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth.middleware');

// 上傳檔案
const fs = require('fs');
const path = require('path');

const { upload, autoCleanupTmp } = require('../../config/multer.config');
const { baseDir } = require('../../config/pathConfig');

const { v4: uuidv4 } = require('uuid');
const { format } = require('date-fns');

const cloudModel = require('../../models/cloudModel')
const { ZipArchive } = require('archiver');

// 獲取 Cloud 資料 -- ok
router.post('/api/cloud/user/getData', authMiddleware(7), async (req, res) => {

    const { parent } = req.body;

    try {

        const cloud = await cloudModel.find({ parent: parent || null }).select('token createTime name type file.size file.mimeType -_id').lean();

        const folders = [];
        const files = [];

        cloud.forEach(item => {

            if (item.type === 'folder') folders.push(item);
            else if (item.type === 'file') files.push(item);

        });

        const historyList = [
            { label: 'ASMC 雲端硬碟', token: '' }
        ];

        if (parent) {

            const parents = [];

            let currentToken = parent;

            while (currentToken) {

                const folder = await cloudModel.findOne({ token: currentToken, type: 'folder' }).select('token name parent -_id').lean();

                if (!folder) break;

                parents.unshift({
                    label: folder.name,
                    token: folder.token
                });

                currentToken = folder.parent;

            }

            historyList.push(...parents);

        }

        return res.send({
            type: 'success',
            data: { folders, files },
            historyList,
            message: 'Cloud 資料獲取成功！'
        });

    } catch (e) {

        console.log(e);

        return res.send({
            type: 'error',
            data: { folders: [], files: [] },
            historyList: [],
            message: '伺服器錯誤，請洽客服人員協助。'
        });

    }

});

// 上傳檔案
router.post('/api/cloud/user/upload', authMiddleware(7), upload.single('file'), autoCleanupTmp, async (req, res) => {

        const { parent } = req.body;

        if (!req.file) {
            return res.send({
                type: 'error',
                message: '檔案不可為空。'
            });
        }

        try {

            const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

            if (parent) {

                const parentFolder = await cloudModel.findOne({ token: parent, type: 'folder' });
                if (!parentFolder) return res.send({ type: 'error', message: '上層資料夾不存在。' });

            }


            const existingFile = await cloudModel.findOne({
                parent: parent || null, name: originalName, type: 'file'
            });

            if (existingFile) {
                return res.send({ type: 'error', message: '同一資料夾下已有相同名稱的檔案。' });
            }


            const uploadDir = path.join(baseDir, 'asmc');

            await fs.promises.mkdir(uploadDir, { recursive: true });


            const fileName = req.file.filename;

            const filePath = path.join(uploadDir, fileName);

            await fs.promises.rename(req.file.path, filePath);


            try {

                const file = new cloudModel({

                    token: uuidv4(),

                    name: originalName,

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


                try {
                    await fs.promises.unlink(filePath);
                } 
                catch (unlinkError) {
                    console.log('刪除實體檔案失敗：', unlinkError);
                }

                throw e;

            }

        } catch (e) {

            console.log(e);

            return res.send({
                type: 'error',
                message: '伺服器錯誤，請洽客服人員協助。'
            });

        }

    }
);

// 建立資料夾 -- ok
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


// 修改 Cloud 名稱 -- ok
router.put('/api/cloud/user/rename', authMiddleware(7), async (req, res) => {

    const { targetCloud, name } = req.body;

    if (!targetCloud || !name) {
        return res.send({
            type: 'error',
            message: '修改資料不可為空。'
        });
    }

    try {

        const cloud = await cloudModel.findOne({ token: targetCloud });

        if (!cloud) return res.send({ type: 'error', message: '檔案或資料夾不存在。' });



        let finalName = name.trim();

        if (cloud.type === 'file') {

            const ext = path.extname(cloud.name);
            if (ext && !finalName.endsWith(ext)) finalName += ext;

        }



        const existingCloud = await cloudModel.findOne({
            token: { $ne: targetCloud },
            parent: cloud.parent,
            name: finalName,
            type: cloud.type
        });

        if (existingCloud) {
            return res.send({
                type: 'error',
                message: cloud.type === 'file'
                    ? '同一資料夾下已有相同名稱的檔案。'
                    : '同一資料夾下已有相同名稱的資料夾。'
            });
        }

        cloud.name = finalName;

        cloud.updateTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss');

        await cloud.save();


        return res.send({
            type: 'success',
            data: cloud,
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


// 刪除 Cloud
router.put('/api/cloud/user/delete', authMiddleware(7), async (req, res) => {

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




// 下載 Cloud（單一檔案 / 整個資料夾）
router.get('/api/cloud/user/download/:targetCloud', authMiddleware(7), async (req, res) => {

        const { targetCloud } = req.params;

        if (!targetCloud) {
            return res.send({ type: 'error', message: '資料不可為空。' });
        }


        try {

            const cloud = await cloudModel.findOne({ token: targetCloud }).lean();


            if (!cloud) {
                return res.send({ type: 'error', message: '檔案或資料夾不存在。' });
            }

            if (cloud.type === 'file') {


                // 檢查檔案路徑
                if (!cloud.file?.path) {
                    return res.send({ type: 'error', message: '找不到檔案路徑。' });
                }


                // 檢查實體檔案是否存在
                try {
                    await fs.promises.access(cloud.file.path, fs.constants.F_OK);
                } 
                catch {
                    return res.send({type: 'error', message: '實體檔案不存在。' });
                }


                // 下載檔案
                return res.download(cloud.file.path, cloud.name);

            }


            if (cloud.type === 'folder') {


                const zipName = `${cloud.name}.zip`;

                res.setHeader('Content-Type', 'application/zip');
                res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`);


                const archive = new ZipArchive({
                    zlib: { level: 9 }
                });

                archive.on('error', (err) => {

                    console.log('ZIP 建立失敗：', err);


                    // 如果 Header 還沒送出
                    if (!res.headersSent) {

                        res.send({ type: 'error',  message: 'ZIP 建立失敗。' });

                    } 
                    else res.destroy(err);

                });


                res.on('close', () => {

                    if (!res.writableEnded) archive.abort();

                });

                archive.pipe(res);

                const addFolderToZip = async (parentToken, currentZipPath) => {


                    // 找出目前資料夾底下的所有項目
                    const children = await cloudModel.find({ parent: parentToken }).lean();


                    // 逐一處理
                    for (const child of children) {

                        const childZipPath = `${currentZipPath}/${child.name}`;

                        if (child.type === 'folder') {

                            archive.append('', { name: `${childZipPath}/` });


                            // 遞迴處理下一層
                            await addFolderToZip(child.token, childZipPath);

                            continue;

                        }


                        if (child.type === 'file' && child.file?.path) {


                            try {

                                // 確認實體檔案存在
                                await fs.promises.access(child.file.path, fs.constants.F_OK);


                                // 加入 ZIP
                                archive.file(child.file.path, { name: childZipPath });

                            } 
                            catch (e) {
                                console.log(`找不到實體檔案：${child.file.path}`);
                            }

                        }

                    }

                };

                archive.append('', { name: `${cloud.name}/` });

                await addFolderToZip(cloud.token, cloud.name);

                await archive.finalize();


                return;

            }

            return res.send({ type: 'error', message: '未知的資料類型。' });


        } catch (e) {

            console.log(e);

            if (!res.headersSent) return res.send({ type: 'error', message: '伺服器錯誤，請洽客服人員協助。' });

            res.destroy(e);

        }

    }
);




module.exports = router;