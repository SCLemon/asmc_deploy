// 門禁控制
// for /door-access-control

// 全頁驗證機制
const express = require('express');
const router = express.Router();

const userModel = require('../../../models/userModel');

const authMiddleware = require('../../../middleware/auth.middleware');

const { addUser, deleteUser, getUserList, getEventLog, system } = require('../../../utils/soyal');

const { addToQueue } = require('../../../utils/soyalQueue');

// 獲取可用裝置列表
router.get('/api/door-access-control/admin/getDevice', authMiddleware(10), async (req, res) => {

    let output = Object.entries(system).map(([key, sys]) => ({
        value: key,
        label: sys.label
    }));

    try{
        return res.send({
            type:'success',
            data: output,
            message:'裝置列表獲取成功。' 
        });
    }
    catch(e){
        console.log(e)
        return res.send({
            type:'error',
            data: [],
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }

});

// 獲取特定門禁的使用者名單
router.post('/api/door-access-control/admin/getUserList', authMiddleware(10), async (req, res) => {

    const { systemId, page } = req.body;

    if (!systemId || !page) {
        return res.send({ type: 'error', data: [], message: '門禁查詢參數不可為空。' });
    }

    try{

        const result = await addToQueue(() => {
            return getUserList(systemId, (page - 1) * 30);
        });

        return res.send(result);
    }
    catch(e){
        console.log(e)
        return res.send({
            type:'error',
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }

});

// 獲取門禁事件
router.post('/api/door-access-control/admin/getEventLog', authMiddleware(10), async (req, res) => {

    const { systemId, page } = req.body;

    if (!systemId || !page) {
        return res.send({ type: 'error', data: [], message: '門禁查詢參數不可為空。' });
    }

    try{

        const result = await addToQueue(() => { return getEventLog(systemId, page); });
        
        if(result.type == 'error') return res.send(result);
        
        const users = await userModel.find({});

        const output = result.data.map(item => {
            const user = users.find(u => {
                return u.idCard == item.cardUID.replace(':', '')
            });

            return {
                index: item.index,
                date: item.date,
                time: item.time,
                user: user?.name,
                detail: item.accessDetail
            }
        })

        return res.send({
            message: 'Event Log 查詢成功。',
            data: output.reverse(),
            type: 'success'
        });
    }
    catch(e){
        console.log(e)
        return res.send({
            type:'error',
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }

});

// 新增或修改使用者資料
router.post('/api/door-access-control/admin/addUser', authMiddleware(10), async (req, res) => {

    const { targetUser, systemId, uAddr } = req.body;

    if (!targetUser || !systemId || (uAddr != 0 && !uAddr)) {
        return res.send({ type: 'error', message: '門禁用戶參數不可為空。' });
    }

    const user = await userModel.findOne({ token: targetUser });
    const idCard = user.idCard;

    const [ uid1, uid2 ] = [idCard.slice(0, 5), idCard.slice(5, 10)];
    
    if (uid1.length != 5 && uid2.length != 5) return res.send({ type: 'error', message: '用戶 ID_Card 資料錯誤。' });

    try{
        const result = await addToQueue(() => {
            return addUser(systemId, uAddr, user.name, uid1, uid2);
        });

        return res.send(result);
    }
    catch(e){
        console.log(e)
        return res.send({
            type:'error',
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }

});

// 刪除使用者資料
router.post('/api/door-access-control/admin/deleteUser', authMiddleware(10), async (req, res) => {

    const { systemId, uAddr } = req.body;

    if (!systemId || (uAddr != 0 && !uAddr)) {
        return res.send({ type: 'error', message: '門禁用戶參數不可為空。' });
    }
    try{
        const result = await addToQueue(() => {
            return deleteUser(systemId, uAddr);
        });

        return res.send(result);
    }
    catch(e){
        console.log(e)
        return res.send({
            type:'error',
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }

});

// 獲取 User 選項
router.get('/api/door-access-control/admin/getUserList', authMiddleware(10), async (req, res) => {

    try {
        const users = await userModel.find({})
        const output = users.map((user) =>{
            return {
                value: user.token,
                label: user.name,
            }
        })

        return res.send({
            type:'success',
            data: output,
            message:'人員列表獲取成功！'
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
