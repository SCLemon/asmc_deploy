const labModel = require('../models/labModel');

const labMiddleware = async (req, res, next) => {
    
    try {

        const lab = await labModel.findOne({ token: req.user.lab }).lean();

        if (!lab || !lab.status) return res.send({ type: 'error', message: '隸屬的實驗室已被停權。' });

        req.lab = lab;

        next();

    } catch (e) {
        console.error(e);
        return res.send({ type: 'error', message: '伺服器錯誤' });
    }
}

module.exports = labMiddleware;