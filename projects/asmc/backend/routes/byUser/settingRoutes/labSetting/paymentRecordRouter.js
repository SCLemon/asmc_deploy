// for /lab-setting

// 全頁驗證機制
const express = require('express');
const router = express.Router();

const labModel = require('../../../../models/labModel');
const userModel = require('../../../../models/userModel');
const equipmentModel =  require('../../../../models/equipmentModel');

const { format } = require('date-fns');
const { v4: uuidv4 } = require('uuid');

const authMiddleware = require('../../../../middleware/auth.middleware');



// 獲取訂單列表
router.get('/api/labSetting/payment/user/getData', authMiddleware(0), async (req, res) => {

    try {

        const labToken = req.user.lab;

        const targetLab = await labModel.findOne({ token: labToken });

        if (!targetLab) {
            return res.send({
                type: 'error',
                data: [],
                message: '實驗室資料不存在。'
            });
        }

        // 找出包含該實驗室預約的所有設備
        const equipments = await equipmentModel.find({
            'reservation.lab': labToken
        }).lean();

        // 收集該實驗室預約的所有使用者
        const userTokens = [];

        equipments.forEach((equipment) => {

            equipment.reservation.forEach((reservation) => {

                // 只收集該實驗室的使用者
                if (reservation.lab !== labToken) return;

                if (reservation.user && !userTokens.includes(reservation.user)) {
                    userTokens.push(reservation.user);
                }

            });

        });

        // 找出預約使用者名稱
        const users = await userModel.find({
            token: { $in: userTokens }
        }).select('token name').lean();

        const userMap = {};

        users.forEach((user) => {
            userMap[user.token] = user.name;
        });

        const output = [];

        let paidAmount = 0;
        let unpaidAmount = 0;

        const now = new Date();

        equipments.forEach((equipment) => {

            equipment.reservation.forEach((reservation) => {

                // 只取該實驗室的預約
                if (reservation.lab !== labToken) return;

                // 預約日期 + 時間
                const reserveDateTime = new Date(
                    `${reservation.reserve_date}T${reservation.reserve_period}:00`
                );

                // 只取已經過去的預約
                if (reserveDateTime >= now) return;

                const payment = reservation.payment || {
                    amount: 0,
                    status: false
                };

                const amount = Number(payment.amount) || 0;

                // 統計付款金額
                if (payment.status === true) {
                    paidAmount += amount;
                } else {
                    unpaidAmount += amount;
                }

                output.push({
                    equipment: equipment.name,
                    equipmentToken: equipment.token,
                    reserveId: reservation.reserveId,
                    username: userMap[reservation.user] || '',
                    reserve_date: reservation.reserve_date,
                    reserve_period: reservation.reserve_period,
                    status: reservation.status,
                    payment
                });

            });

        });

        // 依預約時間由新到舊排序
        output.sort((a, b) => {

            const dateTimeA = new Date(
                `${a.reserve_date}T${a.reserve_period}:00`
            ).getTime();

            const dateTimeB = new Date(
                `${b.reserve_date}T${b.reserve_period}:00`
            ).getTime();

            return dateTimeB - dateTimeA;

        });

        return res.send({
            type: 'success',
            data: {
                output,
                summary: {
                    paidAmount,
                    unpaidAmount
                }
            },
            message: '訂單列表獲取成功！'
        });

    } catch (e) {

        console.log(e);

        return res.send({
            type: 'error',
            data: [],
            message: '伺服器錯誤，請洽客服人員協助。'
        });

    }

});


module.exports = router;