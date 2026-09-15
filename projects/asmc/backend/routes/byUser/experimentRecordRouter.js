// for /experiment-records

// 全頁驗證機制
const express = require('express');
const router = express.Router();

const labModel = require('../../models/labModel');
const userModel = require('../../models/userModel');
const experimentRecordModel = require('../../models/experimentRecordModel');
const cloudModel = require('../../models/cloudModel');
const {format} = require('date-fns');
const { v4: uuidv4 } = require('uuid');

const authMiddleware = require('../../middleware/auth.middleware');
const { createFolder, deleteCloudItem } = require('../../utils/cloudService');


// 獲取計畫列表
router.get('/api/experimentRecords/user/getData', authMiddleware(7), async (req, res) => {

    try {

        const users = await userModel.find({}, 'token name').lean();

        const experimentRecords = await experimentRecordModel.find({ isDeleted: false }).lean();

        // 建立 token -> name 的對應表
        const userMap = new Map(users.map(u => [u.token, u.name]));

        const output = experimentRecords.map((experimentRecord) => {
            return {
                createTime: experimentRecord.createTime,
                token: experimentRecord.token,
                name: experimentRecord.name,
                rate: experimentRecord.rate ?? 0,
                owner: userMap.get(experimentRecord.owner) || '',
                isMine: (experimentRecord.owner) == req.user.token
            };
        });

        return res.send({
            type: 'success',
            data: output,
            message: '實驗計畫列表獲取成功！'
        });

    } catch (e) {

        console.log(e);

        return res.send({
            type: 'error',
            message: '伺服器錯誤，請洽客服人員協助。'
        });

    }

});

// 新增計畫項目
router.post('/api/experimentRecords/user/register', authMiddleware(7), async (req, res) => {

    const token = uuidv4();
    const { name } = req.body;

    if (!name) {
        return res.send({
            type: 'error',
            message: '註冊資料不可為空。'
        });
    }

    try {

        const existingExperimentRecord = await experimentRecordModel.findOne({ name });
        if (existingExperimentRecord) {
            return res.send({
                type: 'error',
                message: '實驗計畫已存在，請選擇其他名稱。'
            });
        }

        const now = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
        
        const newExperimentRecord = new experimentRecordModel({
            createTime: now,
            token,
            name,
            owner: req.user.token
        });
        await newExperimentRecord.save();

        let rootFolder = await cloudModel.findOne({
            name: '實驗數據',
            type: 'folder',
            parent: null,
            owner: 'System'
        });

        if (!rootFolder) {
            const rootRes = await createFolder({
                name: '實驗數據',
                parent: null,
                owner: 'System'
            });
            rootFolder = rootRes.data;
        }

        await createFolder({
            token,
            name,
            parent: rootFolder.token,
            owner: req.user.token
        });

        return res.send({
            type: 'success',
            message: '實驗計畫註冊成功。' 
        });

    } catch (e) {
        console.log(e);
        return res.send({
            type: 'error',
            message: '伺服器錯誤，請洽客服人員協助。'
        });
    }
});

// 刪除計劃項目
router.post('/api/experimentRecords/user/delete', authMiddleware(7), async (req, res) => {

    const { targetExperimentRecord } = req.body;

    if (!targetExperimentRecord) {
        return res.send({
            type: 'error',
            message: '實驗計畫刪除失敗（資料為空）。'
        });
    }

    try {

        const deleteResult = await experimentRecordModel.deleteOne({ 
            token: targetExperimentRecord, 
            owner: req.user.token 
        });

        if (deleteResult.deletedCount === 0) {
            return res.send({ 
                type: 'error', 
                message: '實驗計畫刪除失敗（實驗計畫不存在或無權限）。' 
            });
        }

        await deleteCloudItem(targetExperimentRecord, req.user.token);

        return res.send({ 
            type: 'success',  
            message: '實驗計畫及數據資料夾已刪除成功。' 
        });

    } catch (e) {
        console.log(e);
        return res.send({ 
            type: 'error', 
            message: '伺服器錯誤，請洽客服人員協助。' 
        });
    }
});

// 計劃評分
router.post('/api/experimentRecords/user/rate', authMiddleware(7), async (req, res) => {

    const { targetExperimentRecord, rate } = req.body;

    if (!targetExperimentRecord) {
        return res.send({
            type: 'error',
            message: '實驗計畫評分失敗（資料為空）。'
        });
    }

    try {

        const target = await experimentRecordModel.findOne({ 
            token: targetExperimentRecord, 
            owner: req.user.token 
        });

        if (!target) {
            return res.send({ 
                type: 'error', 
                message: '實驗計畫評分失敗（實驗計畫不存在或無權限）。' 
            });
        }

        target.rate = rate;

        await target.save();

        return res.send({ 
            type: 'success',  
            message: '實驗計畫評分成功。' 
        });

    } catch (e) {
        console.log(e);
        return res.send({ 
            type: 'error', 
            message: '伺服器錯誤，請洽客服人員協助。' 
        });
    }
});


// 獲取特定計畫資料
router.post('/api/experimentRecords/user/getSpecificData', authMiddleware(7), async (req, res) => {

    const { targetRecord } = req.body;

    const record = await experimentRecordModel.findOne({ token: targetRecord });

    if(!record) return res.send({ type:'error', data: [], message:'查無此實驗計畫！' });

    try {

        const output = {
            title: record.name,
            dataSet: record.recipe,
            isMine: record.owner == req.user.token,
        }

        return res.send({
            type:'success',
            data: output,
            message:'實驗計畫獲取成功！'
        });
        
    } catch (e) {
        console.log(e)
        return res.send({
            type:'error',
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }
});

// 重新命名
router.put('/api/experimentRecords/user/rename', authMiddleware(7), async (req, res) => {

    const { targetRecord, name } = req.body;

    if (!targetRecord || !name || name.trim() == '') {
        return res.send({
            type:'error',
            message:'修改資料不可為空。'
        });
    }

    
    const existingExperimentRecord = await experimentRecordModel.findOne({ name });
    if (existingExperimentRecord) {
        return res.send({ type: 'error', message: '實驗計畫已存在，請選擇其他名稱。'});
    }

    const record = await experimentRecordModel.findOne({ token: targetRecord, owner: req.user.token });

    if(!record) return res.send({ type:'error', data: [], message:'查無此實驗計畫！' });

    try {

        record.name = name;
        
        await record.save();

        return res.send({ type:'success', message:'實驗重新命名成功！' });
        
    } catch (e) {
        console.log(e)
        return res.send({
            type:'error',
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }
});

// save
router.post('/api/experimentRecords/user/save', authMiddleware(7), async (req, res) => {

    let { targetRecord, dataSet } = req.body;

    if (!targetRecord || !dataSet) {
        return res.send({
            type:'error',
            message:'儲存資料不可為空。'
        });
    }

    try {

        const record = await experimentRecordModel.findOne({ token: targetRecord, owner: req.user.token });
        if(!record) return res.send({ type:'error', data: [], message:'查無此實驗計畫！' });
        
        record.recipe = dataSet;

        await record.save();

        return res.send({
            type:'success',
            message:'實驗計畫修改成功。' 
        });

    } catch (e) {
        console.log(e)
        return res.send({
            type:'error',
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }
});



module.exports = router;