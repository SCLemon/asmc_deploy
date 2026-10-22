const mongoose = require('mongoose');

const toolSchema = new mongoose.Schema({
    token: {
        type: String,
        required:true,
        unique: true,
        trim: true,
    },
    author: {
        type: String,
        trim: true,
    },
    abstract: {
        type: String,
        default: ''
    },
    iconUrl: {
        type: String,
        default: ''
    },
    status:{
        type: Boolean,
        default: true,
    },
    name:{
        type: String,
        trim: true,
        default: ''
    },
    version:{
        type:String,
        default:''
    },
});


const toolModel = mongoose.model('Tools', toolSchema);

module.exports = toolModel;
