// for /cloud

// 全頁驗證機制
const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth.middleware');

// 上傳檔案
const os = require('os');
const fs = require('fs');
const path = require('path');

const { upload, autoCleanupTmp } = require('../../config/multer.config');
const { baseDir } = require('../../config/pathConfig');

const { v4: uuidv4 } = require('uuid');
const { format } = require('date-fns');

const cloudModel = require('../../models/cloudModel')
const { ZipArchive } = require('archiver');

const { createFolder, deleteCloudItem } = require('../../utils/cloudService');

// 獲取 Cloud 資料
router.post('/api/cloud/user/getData', authMiddleware(7), async (req, res) => {
    const { parent, keyword } = req.body;

    try {
        let condition = {};

        if (keyword) {
            const nameQuery = { name: { $regex: keyword, $options: 'i' }, type: 'file' };

            if (parent) {

                const hierarchy = await cloudModel.aggregate([
                    { $match: { token: parent, type: 'folder' } },
                    {
                        $graphLookup: {
                            from: 'clouds',
                            startWith: '$token',
                            connectFromField: 'token',
                            connectToField: 'parent',
                            as: 'descendants'
                        }
                    },
                    {
                        $project: {
                            allTokens: {
                                $concatArrays: [
                                    ['$token'],
                                    '$descendants.token'
                                ]
                            }
                        }
                    }
                ]);

                const targetTokens = hierarchy.length ? hierarchy[0].allTokens : [parent];

                condition = {
                    parent: { $in: targetTokens },
                    ...nameQuery
                };
            } 
            else condition = nameQuery;
        } 
        else condition = { parent: parent || null };

        const cloud = await cloudModel.find(condition)
            .select('token createTime name type file.size file.mimeType parent -_id')
            .lean();

        const folders = [];
        const files = [];

        cloud.forEach(item => {
            if (item.type === 'folder') folders.push(item);
            else if (item.type === 'file') files.push(item);
        });

        // 麵包屑路徑生成
        const historyList = [
            { label: 'ASMC 雲端硬碟', token: '' }
        ];

        if (parent) {
            const parents = [];
            let currentToken = parent;

            while (currentToken) {
                const folder = await cloudModel.findOne({ token: currentToken, type: 'folder' })
                    .select('token name parent -_id')
                    .lean();

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

    } 
    catch (e) {
        console.error(e);
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

// 建立資料夾
router.post('/api/cloud/user/createFolder', authMiddleware(7), async (req, res) => {
    const { name, parent } = req.body;

    try {
        const result = await createFolder({
            name,
            parent,
            owner: req.user.token
        });

        if (!result.success) {
            return res.send({ type: 'error', message: result.message });
        }

        return res.send({
            type: 'success',
            data: result.data,
            message: result.message
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
router.put('/api/cloud/user/rename', authMiddleware(7), async (req, res) => {
    const { targetCloud, name } = req.body;

    if (!targetCloud || !name) {
        return res.send({
            type: 'error',
            message: '修改資料不可為空。'
        });
    }

    try {
        // 1. 動態組裝查詢條件：若 level === 10 則不限制 owner
        const query = { token: targetCloud };
        if (req.user.level != 10) {
            query.owner = req.user.token;
        }

        const cloud = await cloudModel.findOne(query);

        if (!cloud) {
            return res.send({
                type: 'error',
                message: '檔案或資料夾不存在或無權限修改。'
            });
        }

        let finalName = name.trim();

        if (cloud.type === 'file') {
            const ext = path.extname(cloud.name);
            if (ext && !finalName.endsWith(ext)) finalName += ext;
        }

        // 2. 檢查同層同類型名稱是否重複
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

    try {
        const result = await deleteCloudItem(targetCloud, req.user.token);

        if (!result.success) {
            return res.send({ type: 'error', message: result.message });
        }

        return res.send({ type: 'success', message: result.message });
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
        return res.status(400).send({ type: 'error', message: '資料不可為空。' });
    }

    try {
        const cloud = await cloudModel.findOne({ token: targetCloud }).lean();

        if (!cloud) {
            return res.status(404).send({ type: 'error', message: '檔案或資料夾不存在。' });
        }

        // ========================
        // 1. 單一檔案下載
        // ========================
        if (cloud.type === 'file') {
            if (!cloud.file?.path) {
                return res.status(404).send({ type: 'error', message: '找不到檔案路徑。' });
            }

            try {
                await fs.promises.access(cloud.file.path, fs.constants.F_OK);
            } catch {
                return res.status(404).send({ type: 'error', message: '實體檔案不存在。' });
            }

            // 取得檔案大小並回傳 Content-Length
            const stat = await fs.promises.stat(cloud.file.path);

            res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Disposition');
            res.setHeader('Content-Length', stat.size);

            return res.download(cloud.file.path, cloud.name);
        }

        // ========================
        // 2. 資料夾壓縮下載 (使用 new ZipArchive)
        // ========================
        if (cloud.type === 'folder') {
            const zipName = `${cloud.name}.zip`;
            // 建立暫存檔以計算總大小 (Content-Length)
            const tempZipPath = path.join(os.tmpdir(), `temp_${Date.now()}_${encodeURIComponent(zipName)}`);
            const output = fs.createWriteStream(tempZipPath);

            // 透過 new ZipArchive 建構實例
            const archive = new ZipArchive({
                zlib: { level: 9 }
            });

            archive.pipe(output);

            archive.on('error', (err) => {
                console.error('ZIP 建立失敗：', err);
                if (!res.headersSent) {
                    res.status(500).send({ type: 'error', message: 'ZIP 建立失敗。' });
                } else {
                    res.destroy(err);
                }
            });

            // 遞迴加入資料夾與檔案
            const addFolderToZip = async (parentToken, currentZipPath) => {
                const children = await cloudModel.find({ parent: parentToken }).lean();

                for (const child of children) {
                    const childZipPath = `${currentZipPath}/${child.name}`;

                    if (child.type === 'folder') {
                        archive.append('', { name: `${childZipPath}/` });
                        await addFolderToZip(child.token, childZipPath);
                        continue;
                    }

                    if (child.type === 'file' && child.file?.path) {
                        try {
                            await fs.promises.access(child.file.path, fs.constants.F_OK);
                            // 將實體檔案壓入 ZIP 內的指定相對路徑
                            archive.file(child.file.path, { name: childZipPath });
                        } catch (e) {
                            console.warn(`找不到實體檔案：${child.file.path}`);
                        }
                    }
                }
            };

            // 根目錄與子層處理
            archive.append('', { name: `${cloud.name}/` });
            await addFolderToZip(cloud.token, cloud.name);
            await archive.finalize();

            // 等待暫存檔案完全寫入完成
            await new Promise((resolve, reject) => {
                output.on('close', resolve);
                output.on('error', reject);
            });

            // 取得產生出來的 ZIP 實體大小
            const zipStat = await fs.promises.stat(tempZipPath);

            // 設定標頭：暴露 Content-Length 供前端讀取進度百分比
            res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Disposition');
            res.setHeader('Content-Length', zipStat.size);
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`);

            // 串流輸出到客戶端
            const fileStream = fs.createReadStream(tempZipPath);
            fileStream.pipe(res);

            // 傳輸完畢後刪除磁碟上的暫存檔
            fileStream.on('close', () => {
                fs.promises.unlink(tempZipPath).catch(() => {});
            });

            return;
        }

        return res.status(400).send({ type: 'error', message: '未知的資料類型。' });

    } catch (e) {
        console.error(e);
        if (!res.headersSent) {
            return res.status(500).send({ type: 'error', message: '伺服器錯誤，請洽客服人員協助。' });
        }
        res.destroy(e);
    }
});

module.exports = router;