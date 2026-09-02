// for /member-setting

// 全頁驗證機制
const express = require('express');
const router = express.Router();

const userModel = require('../../models/userModel');

const authMiddleware = require('../../middleware/auth.middleware');
const { tokenCache } = require('../../cache/cache');

const labModel = require('../../models/labModel');



// 獲取特定使用者資料
router.get('/api/profile/user/getData', authMiddleware(0), async (req, res) => {

    try {
        const user = req.user;
        const lab = await labModel.findOne({ token: user.lab });

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
            lab: lab?.name,
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

// 修改用戶
router.post('/api/profile/user/revise', authMiddleware(0), async (req, res) => {

    let { name, password, phoneNumber, mailAddress, idCard } = req.body;
    
    const targetUser = req.headers['x-user-token'];

    if (!password || !name) {
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



module.exports = router;