const mongoose = require('mongoose');

const cloudSchema = new mongoose.Schema({

    token: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },

    name: {
        type: String,
        required: true,
        trim: true
    },

    type: {
        type: String,
        enum: ['folder', 'file'],
        required: true
    },

    parent: {
        type: String,
        default: null
    },

    owner: {
        type: String,
        required: true
    },

    // file 專用
    file: {
        path: {
            type: String,
            default: ''
        },

        size: {
            type: Number,
            default: 0
        },

        mimeType: {
            type: String,
            default: ''
        }
    },

    createTime: {
        type: String
    },

    updateTime: {
        type: String
    }

});

const cloudModel = mongoose.model('Cloud', cloudSchema);

module.exports = cloudModel;