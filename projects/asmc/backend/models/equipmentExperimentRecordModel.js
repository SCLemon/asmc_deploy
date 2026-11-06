// 這是儲存使用者答案的 schema

const mongoose = require('mongoose');

const equipmentExperimentRecordSchema = new mongoose.Schema({
    equipment: { // 對應儀器 ID
        type: String,
        required: true,
        trim: true,
    },
    createTime: { // 紀錄建立時間
        type: Date,
        default: Date.now,
    },
    user: { // userToken
        type: String,
    },
    questions: { // 保存當下的題目、順序及使用者答案
        type: Array,
        default: []
    }
});


const equipmentExperimentRecordModel = mongoose.model('equipmentExperimentRecord', equipmentExperimentRecordSchema);

module.exports = equipmentExperimentRecordModel;