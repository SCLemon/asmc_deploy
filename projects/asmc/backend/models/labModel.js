const mongoose = require('mongoose');

const labSchema = new mongoose.Schema({
    createTime:String,
    token: {
        type: String,
        required:true,
        unique: true,
        trim: true,
    },
    name:{
        type: String,
        trim: true,
        default: 'User',
    },
    status:{
        type: Boolean,
        default: true,
    },
    mailAddress:{
        type: String,
        trim: true,
        default:''
    },
    phoneNumber:{
        type: String,
        trim: true,
        default:''
    },
    location:{
        type: String,
        trim: true,
        default:''        
    }
});


const labModel = mongoose.model('Lab', labSchema);

module.exports = labModel;
