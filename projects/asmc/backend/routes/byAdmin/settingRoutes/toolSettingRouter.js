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
            imgUrl: tool.imgUrl,
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
                abstract: tool.abstract
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


module.exports = router;