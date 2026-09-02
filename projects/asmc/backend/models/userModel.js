const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    createTime:String,
    // 私人特徵碼（uuid）
    token: {
        type: String,
        required:true,
        unique: true,
        trim: true,
    },
    status:{
        type: Boolean,
        default: true,
    },
    level:{
        type: Number,
        required:true,
    },
    account:{
        type:String,
        required:true,
        unique: true,
        trim: true,
    },
    password:{
        type:String,
        required:true,
        trim: true,
    },
    name:{
        type: String,
        trim: true,
        default: 'User',
    },
    lastOnline:{
        type:String,
        default:''
    },
    historyRecord:{
        type: Array,
        default: []
    },
    lab: {
        type:String,
        trim: true,
        default:''
    },
    phoneNumber:{
        type:String,
        trim: true,
        default:''
    },
    mailAddress:{
        type:String,
        trim: true,
        default:''
    },
    idCard:{
        type:String,
        trim: true,
        default:''
    },
});


const userModel = mongoose.model('User', userSchema);

module.exports = userModel;
