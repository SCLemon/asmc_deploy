// 涉及 notification 功能的統一管理文件

// 全頁驗證機制
const express = require('express');
const router = express.Router();

const roomModel = require('../models/roomModel');

const {format} = require('date-fns');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const authMiddleware = require('../middleware/auth.middleware');
const subscribeModel = require('../models/subscribeModel');
const userModel = require('../models/userModel');
const { pushNotification } = require('./service-worker/serviceWorker');
const notificationModel = require('../models/notificationModel');
const roomMiddleware = require('../middleware/room.middleware');


// 獲取通知資料
router.get('/api/notify/getData',authMiddleware, async (req, res) => {
    
    const token = req.headers['x-user-token']
    
    try {
       
        const target = await notificationModel.findOne({ token: token });

        if(!target){
            return res.send({
                type:'success',
                data:[],
                message:'沒有新的通知。'
            });
        }

        const formattedData = target.list.map(item => {
            const itemDate = new Date(item.createTime);
            const now = new Date();
            const isToday = itemDate.toDateString() === now.toDateString();
            
            const { author, content, ...rest } = item._doc;

            return {
                ...rest,
                createTime: isToday ? format(itemDate, 'HH:mm') : format(itemDate, 'yy.MM.dd')
            }
        });

        return res.send({
            type:'success',
            data:formattedData.reverse(),
            message:'成功獲取通知資料。'
        });

    } catch (e) {
        console.log(e);
        return res.send({
            type: 'error',
            message: '伺服器錯誤，請洽客服人員協助。',
        });
    }
});

// 獲取特定資料
router.get(`/api/notify/getSpecificData/:idx`,authMiddleware, async (req, res) => {
    
    const token = req.headers['x-user-token']
    
    try {
       
        const target = await notificationModel.findOne({ token: token});

        if(!target){
            return res.send({
                type:'error',
                data: {},
                message:'沒有找到通知資料。'
            });
        }

        const record = target.list.find(r => r.idx === req.params.idx);

        const author = await userModel.findOne({ token: record.author });

        const output = {
            title: record.title,
            content: record.content,
            createTime: record.createTime,
            author: {
                name: author.name,
                userImgUrl: author.userImgUrl.url
            }
        }
        if(!record){
            return res.send({
                type:'error',
                data: {},
                message:'沒有找到對應的通知紀錄。'
            });
        }

        return res.send({
            type:'success',
            data: output,
            message:'成功獲取通知資料。'
        });

    } catch (e) {
        console.log(e);
        return res.send({
            type: 'error',
            message: '伺服器錯誤，請洽客服人員協助。',
        });
    }
});

// 顯示為已讀
router.post('/api/notify/markRead',authMiddleware, async (req, res) => {
    
    const token = req.headers['x-user-token'];
    const { idx } = req.body;
    
    try {
       
        const target = await notificationModel.findOne({ token: token });

        if(!target){
            return res.send({
                type:'error',
                message:'沒有找到通知資料。'
            });
        }

        const record = target.list.find(r => r.idx === idx);

        if(record){
            record.isRead = true;
            await target.save();
            return res.send({
                type:'success',
                message:'成功標記為已讀。'
            });
        }
        else {
            return res.send({
                type:'error',
                message:'沒有找到對應的通知紀錄。'
            });
        }

    } catch (e) {
        console.log(e);
        return res.send({
            type: 'error',
            message: '伺服器錯誤，請洽客服人員協助。',
        });
    }
});

// 戳戳對方
router.get('/api/notify/poke',authMiddleware, roomMiddleware, async (req, res) => {
    
    const token = req.headers['x-user-token']
    
    try {
       
        const room = req.room;

        if(!room){
            return res.send({
                type:'error',
                message:'傳送通知失敗（房間不存在）。'
            });
        }

        const partnerToken = room.owners.find(t => t !== token);

        const pSubscription = await subscribeModel.findOne({token: partnerToken})

        if(pSubscription){
            await pushNotification('您的伴侶剛才戳了你一下！', '有人偷偷想你了 💌', undefined, pSubscription.subscription);
        }

        const record = await recordNotification(token, '您的伴侶剛才戳了你一下！', '有人偷偷想你了 💌' ,`您的伴侶於 ${format(new Date(), 'yyyy.MM.dd HH:mm:ss')} 戳了您一下，TA 可能正在等待您的回覆，請記得抽空陪伴您的伴侶 💛`, partnerToken);
        
        return res.send(record);

    } catch (e) {
        console.log(e);
        return res.send({
            type: 'error',
            message: '伺服器錯誤，請洽客服人員協助。',
        });
    }
});

// 傳送訊息
router.post('/api/notify/sendMessage',authMiddleware, roomMiddleware, async (req, res) => {
    
    const { title, content } = req.body;

    const token = req.headers['x-user-token']
    
    try {
       
        const room = req.room;

        if(!room){
            return res.send({
                type:'error',
                message:'傳送訊息失敗（房間不存在）。'
            });
        }

        const partnerToken = room.owners.find(t => t !== token);

        const pSubscription = await subscribeModel.findOne({token: partnerToken})

        if(pSubscription){
            await pushNotification('您的伴侶剛才傳送了一封訊息！', '開啟通知閱讀完整內容。', undefined, pSubscription.subscription);
        }

        const record = await recordNotification(token, '信件：' + title, '開啟通知閱讀完整內容。', content, partnerToken);
        
        return res.send(record);

    } catch (e) {
        console.log(e);
        return res.send({
            type: 'error',
            message: '伺服器錯誤，請洽客服人員協助。',
        });
    }
});

async function recordNotification(from, title, subTitle, content, to){
    try{
        const target = await notificationModel.findOne({token: to});
    
        const record = {
            createTime: format(new Date(), 'yyyy.MM.dd HH:mm:ss'),
            idx: uuidv4(),
            title,
            subTitle,
            content,
            author: from
        }

        if(!target){
            await notificationModel.create({
                token: to,
                list:[record]
            })
        }
        else {
            // 只保留最近的 250 筆記錄
            if(target.list.length >= 250){
                target.list.shift();
            }
            target.list.push(record);
            await target.save();
        }
        return {type:'success', message:'通知紀錄成功。'}
    }
    catch(e){
        console.log(e)
        return {type:'error', message:'通知紀錄失敗。'}
    }
}


module.exports = {
    router, recordNotification
};