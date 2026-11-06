
// for /equipment-record

// 全頁驗證機制
const express = require('express');
const router = express.Router();

const equipmentModel = require('../../../models/equipmentModel');
const userModel = require('../../../models/userModel');
const equipmentRecordModel = require('../../../models/equipmentRecordModel');
const equipmentExperimentRecordModel = require('../../../models/equipmentExperimentRecordModel')

const authMiddleware = require('../../../middleware/auth.middleware');


// 檢查儀器操作權限
async function checkEquipmentPermission(targetEquipment, user) {

    const equipment = await equipmentModel.findOne({
        token: targetEquipment,
        isDeleted: false
    });

    if (!equipment) {
        return {
            allowed: false,
            status: 404,
            message: '找不到指定的儀器'
        };
    }

    // Admin 或該儀器的 SuperUser 才能操作
    if (user.level == 10 || equipment.superUser == user.token) {
        return {
            allowed: true,
            equipment
        };
    }

    return {
        allowed: false,
        status: 403,
        message: '您沒有權限操作此儀器'
    };

}


// 獲取儀器列表
router.get('/api/equipmentRecord/superUser/getData', authMiddleware(4), async (req, res) => {

    try {

        const query = {
            isDeleted: false
        };

        const isAdmin = req.user.level == 10;

        if (!isAdmin) {
            query.superUser = req.user.token;
        }

        const equipments = await equipmentModel.find(query)
            .select('token name')
            .sort({ name: 1 })
            .lean();

        const output = equipments.map(equipment => ({
            value: equipment.token,
            label: equipment.name
        }));

        return res.send({
            type: 'success',
            data: output,
            message: '儀器列表獲取成功！'
        });

    }
    catch (e) {

        console.error(e);

        return res.status(500).send({
            type: 'error',
            message: '伺服器錯誤，請洽客服人員協助。'
        });

    }

});


// 獲取儀器問題列表
router.post('/api/equipmentRecord/superUser/getQuestions', authMiddleware(4), async (req, res) => {

    try {

        const { targetEquipment } = req.body;

        if (!targetEquipment) {
            return res.status(400).send({
                type: 'error',
                message: '缺少儀器識別資訊'
            });
        }

        // 權限驗證
        const permission = await checkEquipmentPermission(targetEquipment, req.user);

        if (!permission.allowed) {
            return res.status(permission.status).send({
                type: 'error',
                message: permission.message
            });
        }

        // 獲取題目設定
        const data = await equipmentRecordModel.findOne({
            equipment: targetEquipment
        })
            .select('questions')
            .lean();

        return res.send({
            type: 'success',
            message: '取得儀器題目設定成功',
            data: {
                questions: data?.questions || []
            }
        });

    }
    catch (e) {

        console.error(e);

        return res.status(500).send({
            type: 'error',
            message: '取得儀器題目設定失敗'
        });

    }

});


// 儲存儀器問題列表
router.post('/api/equipmentRecord/superUser/saveQuestions', authMiddleware(4), async (req, res) => {

    try {

        const { targetEquipment, questions } = req.body;

        if (!targetEquipment || !Array.isArray(questions)) {
            return res.status(400).send({
                type: 'error',
                message: '參數格式錯誤'
            });
        }

        // 權限驗證
        const permission = await checkEquipmentPermission(targetEquipment, req.user);

        if (!permission.allowed) {
            return res.status(permission.status).send({
                type: 'error',
                message: permission.message
            });
        }

        // 允許的題目類型
        const validTypes = ['string', 'number', 'checkbox', 'datetime'];

        // 檢查題目格式
        const questionTokens = new Set();

        const invalidQuestion = questions.some(item => {

            if (
                !item ||
                typeof item !== 'object' ||
                typeof item.token !== 'string' ||
                !item.token.trim() ||
                typeof item.question !== 'string' ||
                !item.question.trim() ||
                !validTypes.includes(item.type)
            ) {
                return true;
            }

            // 檢查題目 token 是否重複
            if (questionTokens.has(item.token)) {
                return true;
            }

            questionTokens.add(item.token);

            return false;

        });

        if (invalidQuestion) {
            return res.status(400).send({
                type: 'error',
                message: '題目內容、題目識別碼或題目類型錯誤'
            });
        }

        // 整理題目資料
        const formattedQuestions = questions.map(item => ({
            token: item.token.trim(),
            question: item.question.trim(),
            type: item.type
        }));

        // 儲存題目設定
        await equipmentRecordModel.findOneAndUpdate(
            {
                equipment: targetEquipment
            },
            {
                $set: {
                    questions: formattedQuestions
                }
            },
            {
                upsert: true,
                new: true,
                runValidators: true,
                setDefaultsOnInsert: true
            }
        );

        return res.send({
            type: 'success',
            message: '儀器紀錄題目設定儲存成功'
        });

    }
    catch (e) {

        console.error(e);

        return res.status(500).send({
            type: 'error',
            message: '儲存儀器紀錄題目設定失敗'
        });

    }

});


// 獲取儀器歷史紀錄（分頁）
router.post('/api/equipmentRecord/superUser/getHistory', authMiddleware(4), async (req, res) => {

    try {

        const { targetEquipment } = req.body;

        let { page, pageSize } = req.body;

        if (!targetEquipment) {
            return res.status(400).send({
                type: 'error',
                message: '缺少儀器識別資訊'
            });
        }

        // 檢查儀器權限（Admin 或 SuperUser）
        const permission = await checkEquipmentPermission(targetEquipment, req.user);

        if (!permission.allowed) {
            return res.status(permission.status).send({
                type: 'error',
                message: permission.message
            });
        }

        // 分頁參數
        page = Number(page) || 1;
        pageSize = Number(pageSize) || 1;

        if (
            !Number.isInteger(page) ||
            page < 1 ||
            !Number.isInteger(pageSize) ||
            pageSize < 1 ||
            pageSize > 50
        ) {
            return res.status(400).send({
                type: 'error',
                message: '分頁參數錯誤'
            });
        }

        const query = {
            equipment: targetEquipment
        };

        // 計算總筆數
        const total = await equipmentExperimentRecordModel.countDocuments(query);

        // 獲取指定頁面的歷史紀錄
        const records = await equipmentExperimentRecordModel.find(query)
            .sort({
                createTime: -1,
                _id: -1
            })
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .lean();

        // 取得這些紀錄的使用者 Token
        const userTokens = [
            ...new Set(records.map(record => record.user).filter(Boolean))
        ];

        // 從 userModel 查詢使用者名稱
        const users = await userModel.find({
            token: { $in: userTokens }
        })
            .select('token name')
            .lean();

        // 建立使用者對照表
        const userMap = new Map(
            users.map(user => [user.token, user.name])
        );

        // 將使用者名稱加入歷史紀錄
        const output = records.map(record => ({
            ...record,
            username: userMap.get(record.user) || '未知使用者'
        }));

        return res.send({
            type: 'success',
            message: '儀器歷史紀錄獲取成功',
            data: {
                records: output,
                pagination: {
                    page,
                    pageSize,
                    total,
                    totalPages: Math.ceil(total / pageSize)
                }
            }
        });

    }
    catch (e) {

        console.error(e);

        return res.status(500).send({
            type: 'error',
            message: '取得儀器歷史紀錄失敗'
        });

    }

});


module.exports = router;
