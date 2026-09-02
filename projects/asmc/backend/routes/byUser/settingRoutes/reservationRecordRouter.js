// for /reservation-record

// 全頁驗證機制
const express = require('express');
const router = express.Router();


const equipmentModel = require('../../../models/equipmentModel');
const authMiddleware = require('../../../middleware/auth.middleware');


const { LimitMinute, LateMinute } = require('../../globalConfig/reservationConfig')

// 獲取使用者個人的所有預約記錄（以最新的排在最上面）
router.get('/api/reservationRecord/user/getData', authMiddleware(0), async (req, res) => {

    try {

        const equipments = await equipmentModel.find({
            'reservation.user': req.user.token,
        }).lean();

        const output = [];

        const now = new Date();

        equipments.forEach((equipment) => {

            equipment.reservation.forEach((reservation) => {

                if (reservation.user !== req.user.token) return;

                const reserveDateTime = new Date(`${reservation.reserve_date}T${reservation.reserve_period}:00`);

                const signInDeadline = new Date(reserveDateTime.getTime() + LateMinute * 60 * 1000);

                let signIn = {};
                if(reservation.status == 1){
                    signIn = {
                        showBtn: true,
                        canSignIn: reservation.status == 1 && now >= reserveDateTime,
                        showButtonText: now < reserveDateTime ? '尚未開放' : now >= signInDeadline ? '逾時簽到': '開放簽到'
                    }
                }
                else if(reservation.status == 2) {
                    signIn = { showBtn: false, canSignIn: false, showButtonText: '已簽到' }
                }
                else if(reservation.status == 3) {
                    signIn = { showBtn: false, canSignIn: false, showButtonText: '已簽到' }
                }
                
                // 預約開始前至少 X 分鐘才可以取消
                const cancelDeadline = new Date(reserveDateTime.getTime() - LimitMinute * 60 * 1000);

                output.push({
                    equipment: equipment.name,
                    reserveId: reservation.reserveId,
                    reserve_date: reservation.reserve_date,
                    reserve_period: reservation.reserve_period,
                    signIn,
                    showCancelBtn : !(now >= cancelDeadline)
                });

            });

        });

        // 依照預約日期 + 時段，由新到舊排序
        output.sort((a, b) => {

            const dateTimeA = new Date(`${a.reserve_date}T${a.reserve_period}:00`).getTime();
            const dateTimeB = new Date(`${b.reserve_date}T${b.reserve_period}:00`).getTime();

            return dateTimeB - dateTimeA;
        });

        return res.send({
            type:'success',
            data: output,
            message:'預約紀錄獲取成功！'
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

// 取消預約 -- 前 X 分鐘內無法取消
router.post('/api/reservationRecord/user/cancel', authMiddleware(0), async (req, res) => {

    const { reserveId } = req.body;

    if (!reserveId) {
        return res.send({ type:'error', message:'取消預約失敗（資料為空）。'});
    }

    try {

        // 找出包含該預約的儀器
        const equipment = await equipmentModel.findOne({ 'reservation.reserveId': reserveId });

        if (!equipment) {
            return res.send({ type:'error', message:'取消預約失敗（預約資料不存在）。' });
        }

        // 找出指定預約
        const reservation = equipment.reservation.find((item) => {
            return item.reserveId === reserveId;
        });

        if (!reservation) {
            return res.send({
                type:'error',
                message:'取消預約失敗（預約資料不存在）。'
            });
        }

        // 確認是否為本人預約
        if (reservation.user != req.user.token) {
            return res.send({
                type:'error',
                message:'取消預約失敗（無法取消其他使用者的預約）。'
            });
        }

        // 已簽到不可取消
        if (reservation.status == 2 || reservation.status == 3) {
            return res.send({
                type:'error',
                message:'取消預約失敗（該預約已簽到）。'
            });
        }

        // 計算預約開始時間
        const reserveDateTime = new Date(`${reservation.reserve_date}T${reservation.reserve_period}:00`);

        const now = new Date();

        // 預約開始前至少 X 分鐘才可以取消
        const cancelDeadline = new Date(reserveDateTime.getTime() - LimitMinute * 60 * 1000);

        if (now >= cancelDeadline) {
            return res.send({
                type:'error',
                message:`取消預約失敗（預約開始前 ${LimitMinute} 分鐘內無法取消）。`
            });
        }

        // 移除預約
        equipment.reservation = equipment.reservation.filter((item) => {
            return item.reserveId !== reserveId;
        });

        await equipment.save();

        return res.send({
            type:'success',
            message:'預約取消成功。'
        });

    } catch (e) {
        console.log(e);

        return res.send({
            type:'error',
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }

});

// 預約簽到
router.post('/api/reservationRecord/user/signIn', authMiddleware(0), async (req, res) => {

    const { reserveId } = req.body;

    if (!reserveId) {
        return res.send({ type:'error', message:'簽到失敗（資料為空）。' });
    }

    try {

        // 找出包含該預約的儀器
        const equipment = await equipmentModel.findOne({ 'reservation.reserveId': reserveId, isDeleted: false });

        if (!equipment) {
            return res.send({ type:'error', message:'簽到失敗（預約資料不存在）。' });
        }

        // 找出指定預約
        const reservation = equipment.reservation.find((item) => { return item.reserveId === reserveId; });

        if (!reservation) { return res.send({ type:'error', message:'簽到失敗（預約資料不存在）。' }); }

        // 確認是否為本人預約
        if (reservation.user !== req.user.token) { return res.send({ type:'error', message:'簽到失敗（無法簽到其他使用者的預約）。'}); }

        // 確認目前狀態為「已預約」
        if (reservation.status !== 1) {

            if (reservation.status === 2) {
                return res.send({ type:'error', message:'簽到失敗（該預約已簽到）。' });
            }

            if (reservation.status === 0) {
                return res.send({ type:'error', message:'簽到失敗（該時段尚未被預約）。'});
            }
            
            if (reservation.status === -1) {
                return res.send({ type:'error', message:'簽到失敗（該時段已被禁用）。'});
            }

            return res.send({
                type:'error',
                message:'簽到失敗（該預約目前無法簽到）。'
            });
        }

        // 計算預約開始時間
        const reserveDateTime = new Date(`${reservation.reserve_date}T${reservation.reserve_period}:00`);

        const now = new Date();

        // 尚未到預約時間
        if (now < reserveDateTime) return res.send({ type:'error', message:'簽到失敗（尚未到預約時間）。'});

        // 預約開始後 X 分鐘
        const signInDeadline = new Date(reserveDateTime.getTime() + LateMinute * 60 * 1000);

        // 超過簽到時間
        if (now > signInDeadline) {
            reservation.status = 3; // 記錄為逾時簽到

            await equipment.save();

            return res.send({ type:'success', message:`逾時簽到（已超過預約開始時間 ${LateMinute} 分鐘）。`});
        }

        // 修改為已簽到
        reservation.status = 3;

        await equipment.save();

        return res.send({ type:'success', message:'簽到成功！' });

    } catch (e) {
        console.log(e);

        return res.send({
            type:'error',
            message:'伺服器錯誤，請洽客服人員協助。'
        });
    }

});



module.exports = router;