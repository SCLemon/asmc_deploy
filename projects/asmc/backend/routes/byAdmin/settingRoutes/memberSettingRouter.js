// for /member-setting

// 全頁驗證機制
const express = require('express');
const router = express.Router();

const userModel = require('../../../models/userModel');

const {format} = require('date-fns');
const { v4: uuidv4 } = require('uuid');

const authMiddleware = require('../../../middleware/auth.middleware');
const { tokenCache } = require('../../../cache/cache');

const labModel = require('../../../models/labModel');
const equipmentModel = require('../../../models/equipmentModel');

// 獲取資料
router.get('/api/memberSetting/admin/getData', authMiddleware(10), async (req, res) => {

    try {
        const users = await userModel.find({});
        const labs = await labModel.find({});
        
        const output = users.map((user) =>{
            const lab = labs.filter(lab => user.lab == lab.token)[0];
            return {
                createTime: user.createTime,
                level: user.level,
                name: user.name,
                idCard: user.idCard || '-',
                lab: lab?.name,
                status: user.status,
                token: user.token,
            }
        })
        return res.send({
            type:'success',
            data: output,
            message:'用戶資料獲取成功！'
        });
        
    } catch (e) {
        console.log(e)
        return res.send({
            type:'error',
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }
});

// 獲取特定使用者資料
router.post('/api/memberSetting/admin/getSpecificData', authMiddleware(10), async (req, res) => {

    const { targetUser } = req.body;

    try {

        const user = await userModel.findOne({ token: targetUser });
        if(!user){
            return res.send({
                type:'success',
                data: {},
                message:'使用者資料不存在。'
            });
        }

        const output = {
            account: user.account,
            password: user.password,
            level: user.level,
            name: user.name,
            idCard: user.idCard,
            phoneNumber: user.phoneNumber,
            mailAddress: user.mailAddress,
            lab: user.lab,
            status: user.status
        }

        return res.send({
            type:'success',
            data: output,
            message:'用戶資料獲取成功！'
        });
        
    } catch (e) {
        console.log(e)
        return res.send({
            type:'error',
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }
});

// 新增用戶
router.post('/api/memberSetting/admin/register', authMiddleware(10), async (req, res) => {

    const token =  uuidv4();
    let { name, account, password, level, lab, mailAddress, phoneNumber, idCard } = req.body;

    if (!account || !password || !name || !level || !Number.isInteger(level) || !lab) {
        return res.send({
            type:'error',
            message:'註冊資料不可為空。'
        });
    }

    try {

        const existingUser = await userModel.findOne({ account });
        if (existingUser) {
            return res.send({
                type:'error',
                message:'帳號已存在，請選擇其他帳號。'
            });
        }
        
        const newUser = new userModel({
            createTime: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
            token,
            status: true,
            level,
            account,
            password,
            name,
            lab,
            mailAddress,
            phoneNumber,
            idCard
        });

        await newUser.save();

        return res.send({
            type:'success',
            message:'用戶註冊成功。' 
        });

    } catch (e) {
        console.log(e)
        return res.send({
            type:'error',
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }
});

// 修改用戶
router.post('/api/memberSetting/admin/revise', authMiddleware(10), async (req, res) => {

    let { targetUser, name, password, level, lab, phoneNumber, mailAddress, idCard } = req.body;

    if (!password || !name || !level || !Number.isInteger(level) || !lab) {
        return res.send({
            type:'error',
            message:'註冊資料不可為空。'
        });
    }

    try {

        const user = await userModel.findOne({ token: targetUser });
        if(!user){
            return res.send({
                type:'error',
                message:'使用者資料不存在。'
            });
        }
        
        user.name = name;
        user.password = password;
        user.level = level;
        user.lab = lab;

        user.mailAddress = mailAddress;
        user.phoneNumber = phoneNumber;
        user.idCard = idCard;


        await user.save();

        tokenCache.set(user.token, user);

        return res.send({
            type:'success',
            message:'用戶資料修改成功。' 
        });

    } catch (e) {
        console.log(e)
        return res.send({
            type:'error',
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }
});

// 獲取實驗室列表
router.get('/api/memberSetting/admin/getLabList', authMiddleware(10), async (req, res) => {

    try {
        const labs = await labModel.find({});

        const output = labs.map((lab) =>{
            return {
                token: lab.token,
                name: lab.name,
            }
        })
        return res.send({
            type:'success',
            data: output,
            message:'實驗室列表獲取成功！'
        });
        
    } catch (e) {
        console.log(e)
        return res.send({
            type:'error',
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }
});


// 凍結用戶
router.put('/api/memberSetting/admin/freeze', authMiddleware(10), async (req, res) => {

    let { targetUser } = req.body;

    if (!targetUser) {
        return res.send({
            type:'error', message:'使用者狀態修改失敗（資料為空）。'
        });
    }

    try {

        const existingUser = await userModel.findOne({ token: targetUser });
        if (!existingUser) {
            return res.send({
                type:'error', message:'使用者狀態修改失敗（用戶不存在）。'
            });
        }

        existingUser.status = !existingUser.status;

        // 停權時移除該使用者當前時段以後所有設備預約
        if (!existingUser.status) { 

            const now = new Date();

            const equipments = await equipmentModel.find({
                'reservation.user': existingUser.token,
                isDeleted: false
            }); 

            for (const equipment of equipments) { 

                equipment.reservation = equipment.reservation.filter((item) => {

                    if (item.user !== existingUser.token) return true;

                    const reserveDateTime = new Date(`${item.reserve_date}T${item.reserve_period}:00`);

                    return reserveDateTime < now;
                }); 

                await equipment.save(); 
            }
        }

        await existingUser.save();

        tokenCache.set(existingUser.token, existingUser);

        return res.send({
            type:'success', message:'使用者狀態修改成功。' 
        });

    } catch (e) {
        console.log(e)
        return res.send({
            type:'error', message:'伺服器錯誤，請洽客服人員協助。'
        });
    }
});

// 刪除用戶
router.post('/api/memberSetting/admin/delete', authMiddleware(10), async (req, res) => {

    let { targetUser } = req.body;

    if (!targetUser) {
        return res.send({
            type:'error', message:'用戶刪除失敗（資料為空）。'
        });
    }

    try {

        const deletedUser = await userModel.findOneAndDelete({ token: targetUser });

        if (!deletedUser) {
            return res.send({
                type: 'error',
                message: '用戶刪除失敗（用戶不存在）。'
            });
        }

        tokenCache.delete(deletedUser.token);

        // 刪除時移除該使用者當前時段以後所有設備預約，並從使用者名單中移除
        const now = new Date();

        const equipments = await equipmentModel.find({
            isDeleted: false,
            $or: [
                { 'reservation.user': targetUser },
                { users: targetUser },
                { superUser: targetUser }
            ]
        });

        for (const equipment of equipments) { 

            equipment.reservation = equipment.reservation.filter((item) => {

                if (item.user !== targetUser) return true;

                const reserveDateTime = new Date(`${item.reserve_date}T${item.reserve_period}:00`);

                return reserveDateTime < now;
            });

            equipment.users = equipment.users.filter((user) => user !== targetUser);

            if (equipment.superUser === targetUser) {
                equipment.superUser = '';
            }

            await equipment.save(); 
        }

        return res.send({
            type:'success', message:'使用者刪除成功。' 
        });

    } catch (e) {
        console.log(e)
        return res.send({
            type:'error', message:'伺服器錯誤，請洽客服人員協助。'
        });
    }
});


module.exports = router;