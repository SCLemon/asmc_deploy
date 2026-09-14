const mongoose = require('mongoose');

const experimentRecordSchema = new mongoose.Schema({
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
        default: '',
    },
    owner:{ // owner token
        type: String,
        trim: true,
        default: ''
    },
    rate:{
        type: Number,
        default: 0
    },
    recipe:{
        type: [
            {
                recipeId:{
                    type: String,
                    trim: true,
                },
                order: {
                    type: Number,
                },
                equipment:{
                    type: String,
                    trim: true,
                },
                params: Object
            }
        ],
        default:[]
    }
});


const experimentRecordModel = mongoose.model('experimentRecord', experimentRecordSchema);

module.exports = experimentRecordModel;
