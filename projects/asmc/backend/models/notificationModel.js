const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    token:{
        type: String,
        trim: true,
        unique: true,
        required: true
    },
    list:[
        {
            createTime:String,
            idx: {
                type: String,
                trim: true,
                unique: true,
                required: true
            },
            title:{
                type: String,
                trim: true,
                required: true
            },
            subTitle:{
                type: String,
                trim: true,
                required: true
            },
            content:{
                type: String,
                trim: true,
                required: true
            },
            author:{
                type: String,
                trim: true,
            },
            isRead:{
                type: Boolean,
                default: false,
            }
        }
    ]
});


const notificationModel = mongoose.model('Notification', notificationSchema);

module.exports = notificationModel;
