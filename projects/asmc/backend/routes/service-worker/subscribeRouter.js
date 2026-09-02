// for /moruvi/more/private-setting

// 全頁驗證機制
const express = require('express');
const router = express.Router();

const subscribeModel = require('../models/subscribeModel');

const authMiddleware = require('../middleware/auth.middleware');
const { format } = require('date-fns');

function getDeviceModel(userAgent) {

    // ===== Apple =====

    if (/iPhone/.test(userAgent))
        return 'iPhone';

    if (/iPad/.test(userAgent))
        return 'iPad';

    if (/Macintosh|Mac OS X/.test(userAgent))
        return 'Mac';

    // ===== Windows =====

    if (/Windows NT 10/.test(userAgent))
        return 'Windows 10/11';

    if (/Windows NT 6\.3/.test(userAgent))
        return 'Windows 8.1';

    if (/Windows NT 6\.1/.test(userAgent))
        return 'Windows 7';

    if (/Windows/.test(userAgent))
        return 'Windows';

    // ===== Linux =====

    if (/Linux/.test(userAgent) &&
        !/Android/.test(userAgent))
        return 'Linux';

    // ===== Samsung =====

    let samsung =
        userAgent.match(/SM-[A-Z0-9]+/);

    if (samsung)
        return samsung[0];

    // ===== Xiaomi =====

    let xiaomi =
        userAgent.match(
            /Mi\s[A-Z0-9]+|Redmi\s[A-Z0-9]+/i
        );

    if (xiaomi)
        return xiaomi[0];

    // ===== Google Pixel =====

    let pixel =
        userAgent.match(/Pixel\s\d+/i);

    if (pixel)
        return pixel[0];

    // ===== Huawei =====

    let huawei =
        userAgent.match(
            /HUAWEI\s[A-Z0-9-]+/i
        );

    if (huawei)
        return huawei[0];

    // ===== OPPO / Vivo =====

    let oppo =
        userAgent.match(/CPH\d+|V\d+/);

    if (oppo)
        return oppo[0];

    // ===== Android Generic =====

    if (/Android/.test(userAgent)) {

        let model =
            userAgent.match(
                /Android.*?;\s([^)]+)\sBuild/i
            );

        if (model)
            return model[1].trim();

        return 'Android';
    }

    return 'Unknown Device';
}

// 獲取訂閱資料
router.get('/api/subscribe/get-subscribe', authMiddleware, async (req, res) => {
    const token = req.headers['x-user-token']
    try {
        const subscription = await subscribeModel.findOne({ token })

        if(!subscription){
            return res.send({
                type:'success',
                message:'用戶尚未訂閱。',
                data: {
                    createTime: '',
                    userAgent: '',
                    status: false,
                }
            });
        }

        const output = {
            createTime: subscription.createTime,
            userAgent: subscription.userAgent,
            status: true,
        }

        return res.send({
            type:'success',
            message:'用戶資料獲取成功。',
            data: output
        });

    } catch (e) {
        console.log(e)
        return res.send({
            type:'error',
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }
});

// 訂閱
router.post('/api/subscribe/save-subscribe', authMiddleware, async (req, res) => {
    
    const token = req.headers['x-user-token']
    const userAgent = getDeviceModel(req.headers['user-agent']);
    const createTime = format(new Date(), 'yyyy.MM.dd HH:mm:ss');
    
    try {
        const { subscription } = req.body;

        if (!subscription || !subscription.endpoint) {
            return res.send({ type:'error', message: "缺少訂閱資訊" });
        }

        const existing = await subscribeModel.findOne({ token });

        if (existing) {

            existing.createTime = createTime;
            existing.subscription = subscription;
            existing.userAgent = userAgent;

            await existing.save();
            return res.send({ type:'success', message: "更新訂閱資訊" });
        }

        await subscribeModel.create({ createTime, token, subscription, userAgent });

        return res.send({ type:'success', message: "已儲存訂閱資訊" });
    } 
    catch (err) {
        console.error(err);
        return res.send({ type:'error', message: "伺服器錯誤，無法儲存訂閱資訊" });
    }
});

// 取消訂閱
router.delete('/api/subscribe/cancel-subscribe', authMiddleware, async (req, res) => {
    const token = req.headers['x-user-token']

    try {

        await subscribeModel.deleteOne({ token });

        return res.send({ type:'success', message: "已取消訂閱資訊" });
    } 
    catch (err) {
        console.error(err);
        return res.send({ type:'error', message: "伺服器錯誤，無法取消訂閱資訊" });
    }
});

module.exports = router;