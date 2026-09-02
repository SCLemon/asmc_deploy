// for /reservation

// 全頁驗證機制
const express = require('express');
const router = express.Router();

const userModel = require('../../models/userModel');
const equipmentModel = require('../../models/equipmentModel');
const labModel = require('../..//models/labModel');

const {format} = require('date-fns');
const { v4: uuidv4 } = require('uuid');

const authMiddleware = require('../../middleware/auth.middleware');
const labMiddleware = require('../../middleware/lab.middleware');


// 前幾分鐘要取消
const { LimitMinute } = require('../globalConfig/reservationConfig')

// 獲取儀器列表
router.get('/api/reservation/user/getData', authMiddleware(0), labMiddleware, async (req, res) => {

    try {
        const equipments = await equipmentModel.find({ isDeleted: false, status: true, users: req.user.token })
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

// 獲取管理員資料
router.post('/api/reservation/user/getSuperUserInfo', authMiddleware(0), labMiddleware, async (req, res) => {

    const { targetEquipment } = req.body;

    try {

        const equipment = await equipmentModel.findOne({ token: targetEquipment, status: true, isDeleted: false, users: req.user.token });
        if(!equipment){
            return res.send({
                type:'error',
                data: {},
                message:'儀器管理員資訊不存在。'
            });
        }

        const superUser = await userModel.findOne({ token: equipment.superUser });

        let output = {}
        if(superUser) {

            const superUserLab = await labModel.findOne({ token: superUser.lab })
            
            output = {
                name: superUser.name,
                mailAddress: superUser.mailAddress,
                lab: superUserLab?.name
            }
        }

        return res.send({
            type:'success',
            data: output,
            message:'儀器管理員資訊獲取成功！'
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
router.post('/api/reservation/user/getSpecificReservationData', authMiddleware(0), labMiddleware, async (req, res) => {

    const { targetEquipment, date } = req.body;

    if (!targetEquipment || !date || date.length !== 2) {
        return res.send({ type:'error', data: [], message:'請求資料不完整。'});
    }

    try {

        const equipment = await equipmentModel.findOne({ token: targetEquipment, status: true, isDeleted: false, users: req.user.token });

        if(!equipment){
            return res.send({ type:'error', data: [], message:'儀器資料不存在。'});
        }

        const startDate = new Date(date[0]);
        const endDate = new Date(date[1]);

        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);

        const weekList = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

        const reservationMap = {};

        equipment.reservation.forEach((item) => {

            if (!reservationMap[item.reserve_date]) {
                reservationMap[item.reserve_date] = {};
            }

            reservationMap[item.reserve_date][item.reserve_period] = {
                reserveId: item.reserveId,
                reserve_period: item.reserve_period,
                status: item.status,
                isMine: item.user == req.user.token
            };
        });

        const output = [];

        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {

            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(currentDate.getDate()).padStart(2, '0');

            const dateString = `${year}-${month}-${day}`;

            const date_period = [];

            for (let hour = 0; hour < 24; hour++) {

                const period = `${String(hour).padStart(2, '0')}:00`;

                date_period.push(
                    reservationMap[dateString]?.[period] || {
                        reserveId: '',
                        reserve_period: period,
                        status: 0,
                    }
                );
            }

            output.push({
                title: weekList[currentDate.getDay()],
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

// 預約或取消預約
router.post('/api/reservation/user/handleReserve', authMiddleware(0), labMiddleware, async (req, res) => {

    const { targetEquipment, reserveId, method, reserve_date, reserve_period } = req.body;

    if (!targetEquipment || method === undefined || !reserve_date || !reserve_period) {
        return res.send({ type:'error', message:'請求資料不完整。'});
    }

    try {

        const equipment = await equipmentModel.findOne({ token: targetEquipment, status: true, isDeleted: false, users: req.user.token });

        if (!equipment) return res.send({ type:'error', message:'儀器資料不存在。'});

        const reservation = equipment.reservation.find((item) => item.reserveId === reserveId);

        // 將日期與時段組合成預約時間
        const reserveDateTime = new Date(`${reserve_date}T${reserve_period}:00`);
        const now = new Date();

        if (method === 'reserve') {

            // 只能預約當前時間之後的時段
            if (reserveDateTime <= now) {
                return res.send({ type:'error', message:'無法預約已經開始或已過去的時段。'});
            }

            // 時段已被管理員禁用
            if (reservation?.status === -1) {
                return res.send({ type:'error', message:'本時段已被禁用，無法預約。'});
            }

            // 時段已經有其他預約
            if (reservation){
                return res.send({ type:'error', message:'本時段已被預約（請選擇其他時段）。'});
            }

            const newReservation = {
                reserveId: uuidv4(),
                user: req.user.token,
                lab: req.user.lab,
                reserve_date,
                reserve_period,
                status: 1,
                payment: {
                    amount: equipment.rate,
                    status: false
                }
            };

            equipment.reservation.push(newReservation);

        } 
        else if (method === 'cancel') {

            if (!reservation) return res.send({ type:'error', message:'預約資料不存在。'});

            // 確認預約是否為目前使用者本人
            if (reservation.user !== req.user.token) {
                return res.send({ type:'error', message:'無法取消其他使用者的預約。'});
            }

            // 已簽到不可取消
            if (reservation.status == 2 || reservation.status == 3) {
                return res.send({
                    type:'error',
                    message:'取消預約失敗（該預約已簽到）。'
                });
            }

            // 預約開始前至少 X 分鐘才可以取消
            const cancelDeadline = new Date(reserveDateTime.getTime() - LimitMinute * 60 * 1000);

            if (now >= cancelDeadline) {
                return res.send({ type:'error', message:`預約開始前 ${ LimitMinute } 分鐘內無法取消預約。`});
            }

            equipment.reservation = equipment.reservation.filter((item) => {
                return item.reserveId !== reserveId;
            });

        } 
        else {
            return res.send({ type:'error', message:'無效的操作。'});
        }

        await equipment.save();

        return res.send({
            type:'success',
            message: method === 'reserve' ? '預約時段成功！' : '預約取消成功！'
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