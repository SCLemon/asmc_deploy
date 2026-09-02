// for /member-setting

// 全頁驗證機制
const express = require('express');
const router = express.Router();

const userModel = require('../models/userModel');
const labModel = require('../models/labModel');

const { format } = require('date-fns');
const { v4: uuidv4 } = require('uuid');

// 新增實驗室
async function initializeLab(){

    const token =  uuidv4();
    
    const name = 'admin'

    try {

        const existingLab = await labModel.findOne({ name });
        if (existingLab) {
            console.log('lab initialized');
            return existingLab.token;
        }
        
        const newLab = new labModel({
            createTime: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
            token,
            name,
            status: true,
        });

        await newLab.save();

        console.log('lab initialize successfully');
        return newLab.token;


    } 
    catch (e) {
        console.log('lab initialize error');
        return null;
    }
};
// 初始化用戶帳號
async function initialize(){

    const labToken = await initializeLab();

    if(!labToken){
        console.log('initialize failed')
        return;
    }

    const token =  uuidv4();

    const info = {
        createTime: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        token,
        status: true,
        level: 10,
        account: 'admin',
        password: 'admin',
        name: 'admin',
        lab: labToken,
        mailAddress: '',
        phoneNumber: '',
        idCard: ''
    }

    try {

        const existingUser = await userModel.findOne({ account: info.account });
        if (existingUser){
            existingUser.lab = labToken;
            await existingUser.save();
        }
        else{
            const newUser = new userModel(info);
            await newUser.save();
        }
        
        console.log('all initialize successfully');

    } 
    catch (e) {
        console.log('user initialize error');
    }
};

module.exports = {
    initialize
}