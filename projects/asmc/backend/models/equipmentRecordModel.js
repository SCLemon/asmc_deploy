// 這是儲存儀器題目的 schema

const mongoose = require('mongoose');

const equipmentRecordSchema = new mongoose.Schema({
    equipment: { // 對應儀器 ID
        type: String,
        required: true,
        trim: true,
    },
    questions: { // 儲存目前儀器的題目設定
        type: Array,
        default: []
    }
});


const equipmentRecordModel = mongoose.model('equipmentRecord', equipmentRecordSchema);

module.exports = equipmentRecordModel;