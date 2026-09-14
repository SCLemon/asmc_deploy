// for /experiment-records

// 全頁驗證機制
const express = require('express');
const router = express.Router();

const labModel = require('../../models/labModel');
const userModel = require('../../models/userModel');
const equipmentModel = require('../../models/equipmentModel');
const experimentRecordModel = require('../../models/experimentRecordModel');

const {format} = require('date-fns');
const { v4: uuidv4 } = require('uuid');

const authMiddleware = require('../../middleware/auth.middleware');


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
                owner: userMap.get(experimentRecord.owner) || ''
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

    const token =  uuidv4();
    let { name } = req.body;

    if (!name) {
        return res.send({
            type:'error',
            message:'註冊資料不可為空。'
        });
    }

    try {

        const existingExperimentRecord = await experimentRecordModel.findOne({ name, isDeleted: false });
        if (existingExperimentRecord ) {
            return res.send({
                type:'error',
                message:'實驗計畫已存在，請選擇其他計畫名稱。'
            });
        }
        
        const newLab = new experimentRecordModel({
            createTime: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
            token,
            name,
            owner: req.user.token
        });

        await newLab.save();

        return res.send({
            type:'success',
            message:'實驗計畫註冊成功。' 
        });

    } catch (e) {
        console.log(e)
        return res.send({
            type:'error',
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }
});

// 刪除計劃項目
router.post('/api/experimentRecords/user/delete', authMiddleware(7), async (req, res) => {

    let { targetExperimentRecord } = req.body;

    if (!targetExperimentRecord) {
        return res.send({
            type:'error',
            message:'實驗計畫刪除失敗（資料為空）。'
        });
    }

    try {

        // 檢查實驗室是否存在
        const experimentRecord = await experimentRecordModel.findOne({ token: targetExperimentRecord, owner: req.user.token });

        if (!experimentRecord) {
            return res.send({ type: 'error', message: '實驗計畫刪除失敗（實驗計畫不存在）。'});
        }

        // 確認無成員後刪除 Lab
        experimentRecord.isDeleted = true;

        await experimentRecord.save();

        return res.send({ type:'success',  message:'實驗計畫刪除成功。' });

        } catch (e) {
            console.log(e);
            return res.send({ type:'error', message:'伺服器錯誤，請洽客服人員協助。'});
        }
});


// 修改實驗室
router.post('/api/experimentRecords/user/revise', authMiddleware(7), async (req, res) => {

    let { targetLab, name, mailAddress, phoneNumber, location } = req.body;

    if (!name) {
        return res.send({
            type:'error',
            message:'註冊資料不可為空。'
        });
    }

    try {

        // 檢查是否與其他實驗室重名
        const existingLab = await labModel.findOne({ name });
        if (existingLab && existingLab.token != targetLab) {
            return res.send({
                type:'error',
                message:'實驗室已存在，請選擇其他實驗室名稱。'
            });
        }

        const lab = await labModel.findOne({ token: targetLab })

        if(!lab){
            return res.send({
                type:'error',
                message:'實驗室不存在。'
            });
        }
        
        lab.name = name;
        lab.phoneNumber = phoneNumber;
        lab.mailAddress = mailAddress;
        lab.location = location;

        await lab.save();

        return res.send({
            type:'success',
            message:'實驗室資料修改成功。' 
        });

    } catch (e) {
        console.log(e)
        return res.send({
            type:'error',
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }
});


// 獲取特定實驗室資料 -- 實驗室基本資料
router.post('/api/experimentRecords/user/getSpecificData', authMiddleware(7), async (req, res) => {

    const { targetLab } = req.body;

    try {

        const lab = await labModel.findOne({ token: targetLab });
        if(!lab){
            return res.send({
                type:'success',
                data: {},
                message:'實驗室資料不存在。'
            });
        }
        
        const output = {
            name: lab.name,
            phoneNumber: lab.phoneNumber,
            mailAddress: lab.mailAddress,
            location: lab.location
        }

        return res.send({
            type:'success',
            data: output,
            message:'實驗室資料獲取成功！'
        });
        
    } catch (e) {
        console.log(e)
        return res.send({
            type:'error',
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }
});

// 獲取特定實驗室資料 -- 實驗室成員列表
router.post('/api/experimentRecords/user/getSpecificData/labMember', authMiddleware(7), async (req, res) => {

    const { targetLab } = req.body;

    try {

        const users = await userModel.find({ lab: targetLab });

        const output = users.map((user) => {
            return {
                token: user.token,
                name: user.name,
                status: user.status,
            }
        })

        return res.send({
            type:'success',
            data: output,
            message:'實驗室成員列表獲取成功！'
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