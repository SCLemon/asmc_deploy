// for /lab-setting

// 全頁驗證機制
const express = require('express');
const router = express.Router();

const labModel = require('../../../../models/labModel');
const userModel = require('../../../../models/userModel');

const {format} = require('date-fns');
const { v4: uuidv4 } = require('uuid');

const authMiddleware = require('../../../../middleware/auth.middleware');


// 修改實驗室
router.post('/api/labSetting/user/revise', authMiddleware(0), async (req, res) => {

    const targetLab = req.user.lab;
    let { name, mailAddress, phoneNumber, location } = req.body;

    if (!name) {
        return res.send({
            type:'error',
            message:'註冊資料不可為空。'
        });
    }

    try {

        const lab = await labModel.findOne({ token: targetLab })

        if(!lab){
            return res.send({
                type:'error',
                message:'實驗室不存在。'
            });
        }

        // 檢查是否與其他實驗室重名
        const existingLab = await labModel.findOne({ name });
        if (existingLab && existingLab.token != targetLab) {
            return res.send({
                type:'error',
                message:'實驗室已存在，請選擇其他實驗室名稱。'
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
router.get('/api/labSetting/user/getSpecificData', authMiddleware(0), async (req, res) => {

    const targetLab = req.user.lab;

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
router.get('/api/labSetting/user/getSpecificData/labMember', authMiddleware(0), async (req, res) => {

    const targetLab = req.user.lab;

    try {

        const users = await userModel.find({ lab: targetLab });

        const output = users.map((user) => {
            return {
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