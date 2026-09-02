// for /member-setting

// 全頁驗證機制
const express = require('express');
const router = express.Router();

const userModel = require('../models/userModel');

const { format } = require('date-fns');
const { v4: uuidv4 } = require('uuid');


// 初始化用戶帳號
async function initialize(){

    const token =  uuidv4();

    const info = {
        createTime: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        token,
        status: true,
        level: 10,
        account: 'admin',
        password: 'admin',
        name: 'admin',
        lab: '',
        mailAddress: '',
        phoneNumber: '',
        idCard: ''
    }

    try {

        const existingUser = await userModel.findOne({ account: info.account });
        if (existingUser){
            console.log('initialized');
            return
        }
        
        const newUser = new userModel(info);
        await newUser.save();

        console.log('initialize successfully');

    } 
    catch (e) {
        console.log('initialize error');
    }
};

module.exports = {
    initialize
}