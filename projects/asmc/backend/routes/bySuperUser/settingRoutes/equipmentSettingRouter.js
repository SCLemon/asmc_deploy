// for /equipment-setting

// 全頁驗證機制
const express = require('express');
const router = express.Router();

const userModel = require('../../../models/userModel');
const equipmentModel = require('../../../models/equipmentModel');

const {format} = require('date-fns');
const { v4: uuidv4 } = require('uuid');

const authMiddleware = require('../../../middleware/auth.middleware');

// 獲取儀器列表 -- ok
router.get('/api/equipmentSetting/superUser/getData', authMiddleware(4), async (req, res) => {

    try {
        const equipments = await equipmentModel.find({ isDeleted: false, superUser: req.user.token })
        const output = equipments.map((equipment) =>{
            return {
                value: equipment.token,
                label: equipment.name,
            }
        })

        return res.send({
            type:'success',
            data: output,
            message:'儀器列表獲取成功！'
        });
        
    } catch (e) {
        console.log(e)
        return res.send({
            type:'error',
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }
});

// 獲取特定儀器資料 -- ok
router.post('/api/equipmentSetting/superUser/getSpecificData', authMiddleware(4), async (req, res) => {

    const { targetEquipment } = req.body;

    try {

        const equipment = await equipmentModel.findOne({ token: targetEquipment, isDeleted: false, superUser: req.user.token });
        if(!equipment){
            return res.send({
                type:'error',
                data: {},
                message:'儀器資料不存在。'
            });
        }

        return res.send({
            type:'success',
            data: equipment,
            message:'儀器資料獲取成功！'
        });
        
    } catch (e) {
        console.log(e)
        return res.send({
            type:'error',
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }
});

// 修改儀器資訊 -- ok
router.post('/api/equipmentSetting/superUser/revise', authMiddleware(4), async (req, res) => {

    let { targetEquipment, name, rate, users } = req.body;

    if (!name || !Number.isInteger(rate)) {
        return res.send({ type:'error', message:'修改資料不可為空。'});
    }

    try {

        // 檢查是否與其他儀器重名
        const existingEquipment = await equipmentModel.findOne({ name, isDeleted: false, superUser: req.user.token  });

        if (existingEquipment && existingEquipment.token != targetEquipment) {
            return res.send({ type:'error', message:'儀器已存在，請選擇其他儀器名稱。'});
        }

        const equipment = await equipmentModel.findOne({
            token: targetEquipment,
            isDeleted: false
        });

        if (!equipment) {
            return res.send({ type:'error', message:'儀器資料不存在。'});
        }

        // 取得原本的使用者名單
        const oldUsers = equipment.users;

        // 找出被移除的使用者
        const removedUsers = oldUsers.filter((user) => {
            return !users.includes(user);
        });

        equipment.name = name;
        equipment.rate = rate;
        equipment.users = users;

        // 移除被刪除使用者當前時間以後的預約
        if (removedUsers.length > 0) {

            const now = new Date();

            equipment.reservation = equipment.reservation.filter((item) => {

                // 不是被移除的使用者 → 保留
                if (!removedUsers.includes(item.user)) {
                    return true;
                }

                // 被移除的使用者 → 判斷預約時間
                const reserveDateTime = new Date(
                    `${item.reserve_date}T${item.reserve_period}:00`
                );

                // 只保留已經過去的預約
                return reserveDateTime < now;
            });
        }

        await equipment.save();

        return res.send({
            type:'success',
            message:'儀器資料修改成功。'
        });

    } catch (e) {
        console.log(e);

        return res.send({
            type:'error',
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }
});

// 停用儀器 -- ok
router.put('/api/equipmentSetting/superUser/freeze', authMiddleware(4), async (req, res) => {

    let { targetEquipment } = req.body;

    if (!targetEquipment) {
        return res.send({
            type:'error',
            message:'儀器停用失敗（資料為空）。'
        });
    }

    try {

        const existingEquipment = await equipmentModel.findOne({
            token: targetEquipment,
            isDeleted: false,
            superUser: req.user.token 
        });

        if (!existingEquipment) {
            return res.send({
                type:'error',
                message:'儀器停用失敗（儀器不存在）。'
            });
        }

        existingEquipment.status = false;

        // 移除當前時間以後的預約資訊
        const now = new Date();

        existingEquipment.reservation = existingEquipment.reservation.filter((item) => {

            const reserveDateTime = new Date(
                `${item.reserve_date}T${item.reserve_period}:00`
            );

            // 保留已經過去的預約
            return reserveDateTime < now;
        });

        await existingEquipment.save();

        return res.send({
            type:'success',
            message:'儀器停用成功。'
        });

    } catch (e) {
        console.log(e);

        return res.send({
            type:'error',
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }
});

// 重啟儀器 -- ok
router.put('/api/equipmentSetting/superUser/restart', authMiddleware(4), async (req, res) => {

    let { targetEquipment } = req.body;

    if (!targetEquipment) {
        return res.send({
            type:'error', message:'儀器重啟失敗（資料為空）。'
        });
    }

    try {

        const existingEquipment = await equipmentModel.findOne({ token: targetEquipment, isDeleted: false, superUser: req.user.token  });
        if (!existingEquipment) {
            return res.send({
                type:'error', message:'儀器重啟失敗（儀器不存在）。'
            });
        }

        existingEquipment.status = true;     
        await existingEquipment.save();
        

        return res.send({
            type:'success', message:'儀器重啟成功。' 
        });

    } catch (e) {
        console.log(e)
        return res.send({
            type:'error', message:'伺服器錯誤，請洽客服人員協助。'
        });
    }
});

// 刪除儀器 -- ok
router.post('/api/equipmentSetting/superUser/delete', authMiddleware(4), async (req, res) => {

    let { targetEquipment } = req.body;

    if (!targetEquipment) {
        return res.send({
            type:'error',
            message:'儀器刪除失敗（資料為空）。'
        });
    }

    try {

        const deletedEquipment = await equipmentModel.findOne({
            token: targetEquipment,
            isDeleted: false, 
            superUser: req.user.token 
        });

        if (!deletedEquipment) {
            return res.send({
                type: 'error',
                message: '儀器刪除失敗（儀器不存在）。'
            });
        }

        deletedEquipment.isDeleted = true;

        // 移除當前時間以後的預約資訊
        const now = new Date();

        deletedEquipment.reservation = deletedEquipment.reservation.filter((item) => {

            const reserveDateTime = new Date(
                `${item.reserve_date}T${item.reserve_period}:00`
            );

            // 保留當前時間以前的預約
            return reserveDateTime < now;
        });

        await deletedEquipment.save();

        return res.send({
            type:'success',
            message:'儀器刪除成功。'
        });

    } catch (e) {
        console.log(e);

        return res.send({
            type:'error',
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }
});

// 獲取 User 選項
router.get('/api/equipmentSetting/superUser/getUserList', authMiddleware(4), async (req, res) => {

    try {
        const users = await userModel.find({})
        const output = users.map((user) =>{
            return {
                key: user.token,
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


// 獲取預約狀態
router.post('/api/equipmentSetting/superUser/getSpecificReservationData', authMiddleware(4), async (req, res) => {

    const { targetEquipment, date } = req.body;

    if (!targetEquipment || !date || date.length !== 2) {
        return res.send({ type:'error', data: [], message:'請求資料不完整。'});
    }

    try {

        const equipment = await equipmentModel.findOne({
            token: targetEquipment,
            isDeleted: false,
            superUser: req.user.token 
        });

        if(!equipment){
            return res.send({ type:'error', data: [], message:'儀器資料不存在。'});
        }

        const startDate = new Date(date[0]);
        const endDate = new Date(date[1]);

        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);

        // 找出所有 reservation 中的 user token
        const userTokens = [
            ...new Set(
                equipment.reservation
                    .map((item) => item.user)
                    .filter(Boolean)
            )
        ];

        // 一次取得所有使用者
        const users = await userModel.find({
            token: { $in: userTokens }
        }).select('token name').lean();

        // 建立 token -> name 對照表
        const userMap = {};

        users.forEach((user) => {
            userMap[user.token] = user.name;
        });

        const reservationMap = {};

        equipment.reservation.forEach((item) => {

            if (!reservationMap[item.reserve_date]) {
                reservationMap[item.reserve_date] = {};
            }

            reservationMap[item.reserve_date][item.reserve_period] = {
                reserveId: item.reserveId,
                user: item.user,
                username: userMap[item.user] || '',
                reserve_period: item.reserve_period,
                status: item.status,
                payment: item.payment
            };
        });

        const weekList = ['日', '一', '二', '三', '四', '五', '六'];

        const output = [];

        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {

            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(currentDate.getDate()).padStart(2, '0');

            const dateString = `${year}-${month}-${day}`;

            // 顯示格式：9/1 （日）
            const displayMonth = currentDate.getMonth() + 1;
            const displayDay = currentDate.getDate();

            const title = `${displayMonth}/${displayDay} (${weekList[currentDate.getDay()]})`;

            const date_period = [];

            for (let hour = 0; hour < 24; hour++) {

                const period = `${String(hour).padStart(2, '0')}:00`;

                date_period.push(
                    reservationMap[dateString]?.[period] || {
                        reserveId: '',
                        user: '',
                        username: '',
                        reserve_period: period,
                        status: 0,
                        payment: {
                            amount: 0,
                            status: false
                        }
                    }
                );
            }

            output.push({
                title,
                date: dateString,
                date_period
            });

            currentDate.setDate(currentDate.getDate() + 1);
        }

        return res.send({
            type:'success',
            data: output,
            message:'儀器預約資料獲取成功！'
        });
        
    } catch (e) {
        console.log(e);

        return res.send({
            type:'error',
            data: [],
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }

});

// 禁用 or 解禁 or 刪除他人預約
router.post('/api/equipmentSetting/superUser/handleReserve', authMiddleware(4), async (req, res) => {

    const { targetEquipment, reserveId, method, reserve_date, reserve_period } = req.body;

    if (!targetEquipment || method === undefined || !reserve_date || !reserve_period) {
        return res.send({ type:'error', message:'請求資料不完整。'});
    }

    try {

        // method: disabled 為禁用，若有預約資料則刪除原 reservation 後重新建立 status 為 -1 的預約項目，若無則直接建立
        // method: enabled 為取消他人預約與解禁，刪除原 reservation
        const equipment = await equipmentModel.findOne({ token: targetEquipment, isDeleted: false, superUser: req.user.token  });
        if (!equipment) return res.send({ type:'error', message:'儀器資料不存在。'});

        const reservation = equipment.reservation.find((item) => item.reserveId === reserveId);

        if (method === 'disabled') {

            const newReservation = {
                reserveId: uuidv4(),
                user: 'system',
                lab: 'system',
                reserve_date,
                reserve_period,
                status: -1,
                payment: {
                    amount: 0,
                    status: true
                }
            };

            if (reservation) equipment.reservation = equipment.reservation.filter((item) => { return item.reserveId !== reserveId; });
            equipment.reservation.push(newReservation);

        } 
        else if (method === 'enabled') {

            if (!reservation) return res.send({ type:'error', message:'預約資料不存在。'});

            equipment.reservation = equipment.reservation.filter((item) => {
                return item.reserveId !== reserveId;
            });

        } 
        else return res.send({ type:'error', message:'無效的操作。'});

        await equipment.save();

        return res.send({
            type:'success',
            message: method === 'disabled' ? '預約時段禁用成功！' : '預約取消/解禁成功！'
        });
        
    } catch (e) {
        console.log(e);

        return res.send({
            type:'error',
            data: [],
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }

});

module.exports = router;