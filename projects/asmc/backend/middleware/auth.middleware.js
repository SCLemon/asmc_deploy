const userModel = require('../models/userModel');


const { tokenCache } = require('../cache/cache'); 

const authMiddleware = (level) => {
    
    return async (req, res, next) => {
        const token = req.headers['x-user-token'];

        if (!token) {
            return res.send({ type: 'error', message: '未找到授權，請重新登入。' });
        }

        let user = tokenCache.get(token);

        if (!user) {
            try {

                user = await userModel.findOne({ token }).lean(); 
                
                if (!user) {
                    return res.send({ type: 'error', message: '未找到授權，請重新登入。' });
                }

                tokenCache.set(token, user);
                
            } catch (e) {
                console.error(e);
                return res.send({ type: 'error', message: '伺服器錯誤' });
            }
        }

        if(!user.status) return res.send({ type:'error', message:'帳號已被停權。' });
        
        if(!user.level || user.level < level) return res.send({ type: 'error', message: '訪問權限不足。' });

        req.user = user;
        next();
    };
}


module.exports = authMiddleware;