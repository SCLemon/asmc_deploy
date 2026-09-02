// for /lab-setting

// 全頁驗證機制
const express = require('express');
const router = express.Router();

const {format} = require('date-fns');

const authMiddleware = require('../middleware/auth.middleware');


// 確認要顯示的 settings 項目
router.get('/api/settings/checkPermission', authMiddleware(0), async (req, res) => {

    try {

        return res.send({
            type: 'success',
            data: req.user.level,
            message: 'checked！'
        });
        
    } catch (e) {
        console.log(e);

        return res.send({
            type: 'error',
            message: '伺服器錯誤，請洽客服人員協助。'
        });
    }
});



module.exports = router;