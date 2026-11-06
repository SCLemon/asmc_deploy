
// 全頁驗證機制
const express = require('express');
const router = express.Router();

const equipmentModel = require('../../../models/equipmentModel');
const equipmentRecordModel = require('../../../models/equipmentRecordModel');
const equipmentExperimentRecordModel = require('../../../models/equipmentExperimentRecordModel')

const authMiddleware = require('../../../middleware/auth.middleware');
const userModel = require('../../../models/userModel');


// 獲取儀器列表
router.get('/api/equipmentRecord/user/getData', authMiddleware(1), async (req, res) => {

    try {

        const equipments = await equipmentModel.find({ isDeleted: false, users: req.user.token })
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
router.post('/api/equipmentRecord/user/getQuestions', authMiddleware(1), async (req, res) => {

    try {

        const { targetEquipment } = req.body;

        if (!targetEquipment) {
            return res.status(400).send({
                type: 'error',
                message: '缺少儀器識別資訊'
            });
        }

        // 檢查儀器是否存在
        const equipment = await equipmentModel.findOne({
            token: targetEquipment,
            isDeleted: false,
            users: req.user.token
        }).select('token').lean();

        if (!equipment) {
            return res.status(404).send({
                type: 'error',
                message: '找不到指定的儀器'
            });
        }

        // 獲取儀器目前的題目設定
        const data = await equipmentRecordModel.findOne({
            equipment: targetEquipment
        })
            .select('questions')
            .lean();

        // 加入題目順序
        const questions = (data?.questions || []).map((item, index) => ({
            token: item.token,
            order: index,
            question: item.question,
            type: item.type
        }));

        return res.send({
            type: 'success',
            message: '取得儀器題目設定成功',
            data: {
                questions
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


// 儲存儀器填寫紀錄
router.post('/api/equipmentRecord/user/saveData', authMiddleware(1), async (req, res) => {

    try {

        const { targetEquipment, questions } = req.body;

        if (!targetEquipment || !Array.isArray(questions)) {
            return res.status(400).send({
                type: 'error',
                message: '參數格式錯誤'
            });
        }

        // 檢查儀器是否存在
        const equipment = await equipmentModel.findOne({
            token: targetEquipment,
            isDeleted: false,
            users: req.user.token
        }).select('token').lean();

        if (!equipment) {
            return res.status(404).send({
                type: 'error',
                message: '找不到指定的儀器'
            });
        }

        // 允許的題目類型
        const validTypes = ['string', 'number', 'checkbox', 'datetime'];

        const questionTokens = new Set();
        const recordQuestions = [];

        // 檢查並整理使用者填寫的資料
        for (let i = 0; i < questions.length; i++) {

            const item = questions[i];

            if (
                !item ||
                typeof item !== 'object' ||
                typeof item.token !== 'string' ||
                !item.token.trim() ||
                typeof item.question !== 'string' ||
                !item.question.trim() ||
                !validTypes.includes(item.type) ||
                item.order !== i
            ) {
                return res.status(400).send({
                    type: 'error',
                    message: '題目資料格式錯誤'
                });
            }

            // 檢查題目 token 是否重複
            if (questionTokens.has(item.token)) {
                return res.status(400).send({
                    type: 'error',
                    message: '題目識別碼重複'
                });
            }

            questionTokens.add(item.token);

            let value = item.value;

            // 依照題目類型檢查答案
            switch (item.type) {

                case 'string':

                    if (typeof value !== 'string' || !value.trim()) {
                        return res.status(400).send({
                            type: 'error',
                            message: `請填寫題目「${item.question}」`
                        });
                    }

                    value = value.trim();

                    break;


                case 'number':

                    if (
                        typeof value !== 'number' ||
                        !Number.isFinite(value)
                    ) {
                        return res.status(400).send({
                            type: 'error',
                            message: `請輸入題目「${item.question}」的有效數字`
                        });
                    }

                    break;


                case 'checkbox':

                    if (typeof value !== 'boolean') {
                        return res.status(400).send({
                            type: 'error',
                            message: `題目「${item.question}」的答案格式錯誤`
                        });
                    }

                    break;


                case 'datetime':

                    if (
                        !value ||
                        isNaN(new Date(value).getTime())
                    ) {
                        return res.status(400).send({
                            type: 'error',
                            message: `請選擇題目「${item.question}」的日期與時間`
                        });
                    }

                    value = new Date(value);

                    break;

            }

            // 保存當下題目內容、順序、類型與答案
            recordQuestions.push({
                token: item.token.trim(),
                order: item.order,
                question: item.question.trim(),
                type: item.type,
                value
            });

        }

        // 建立新的歷史紀錄
        await equipmentExperimentRecordModel.create({
            equipment: targetEquipment,
            user: req.user.token,
            createTime: new Date(),
            questions: recordQuestions
        });

        return res.send({
            type: 'success',
            message: '儀器紀錄儲存成功'
        });

    }
    catch (e) {

        console.error(e);

        return res.status(500).send({
            type: 'error',
            message: '儲存儀器紀錄失敗'
        });

    }

});


// 獲取儀器歷史紀錄（分頁）
router.post('/api/equipmentRecord/user/getHistory', authMiddleware(1), async (req, res) => {

    try {

        const { targetEquipment } = req.body;

        let { page, pageSize } = req.body;

        if (!targetEquipment) {
            return res.status(400).send({
                type: 'error',
                message: '缺少儀器識別資訊'
            });
        }

        // 檢查儀器是否存在
        const equipment = await equipmentModel.findOne({
            token: targetEquipment,
            isDeleted: false,
            users: req.user.token
        }).select('token').lean();

        if (!equipment) {
            return res.status(404).send({
                type: 'error',
                message: '找不到指定的儀器'
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
