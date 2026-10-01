// for /reservation-record

// 全頁驗證機制
const express = require('express');
const router = express.Router();

const userModel = require('../../../models/userModel');
const authMiddleware = require('../../../middleware/auth.middleware');
const { format } = require('date-fns');
const { tokenCache } = require('../../../cache/cache'); 

// 獲取切結書狀態
router.get('/api/affidavit/user/getData', authMiddleware(0), async (req, res) => {

    try {

        return res.send({
            type:'success',
            data: req.user?.affidavit ?? null,
            message:'切結書狀態獲取成功！'
        });

    } catch (e) {
        console.log(e);

        return res.send({
            type:'error',
            data: null,
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }

});

router.post('/api/affidavit/user/sign', authMiddleware(0), async (req, res) => {

    try {

        const user = await userModel.findOne({ token: req.user.token });

        if(!user) return res.send({ type:'error', message:'使用者資料不存在。' });

        user.affidavit = {
            status: true,
            timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
            ip: req.headers['cf-connecting-ip'] || '',
        }

        await user.save();

        tokenCache.set(user.token, user);
        
        return res.send({
            type:'success',
            message:'切結書簽核成功！'
        });

    } catch (e) {
        console.log(e);

        return res.send({
            type:'error',
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }

});





module.exports = router;