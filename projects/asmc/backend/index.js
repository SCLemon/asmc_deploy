const express = require('express');
const compression = require('compression');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());

app.set('trust proxy', 'loopback, 192.168.0.1'); 


const { initialize } = require('./utils/initialize')

initialize();

const rateLimit = require('express-rate-limit');

// 不受限速
const whitelistRoutes = [
    '/api/img',
];

const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 分鐘
    max: 200,
    message: 'Too many requests from this account, please try again after a minute.',
    keyGenerator: (req, res) => {
        return req.headers['x-user-token'];
    },
    skip: (req, res) => {
        return whitelistRoutes.some(route => req.path.startsWith(route));
    },
    handler: (req, res, next, options) => {
        return res.redirect('/');
    }
});

app.use(limiter);

app.use((req, res, next) => {
  next();
});


// 初始化資料庫
const { connectToDatabase, disconnectFromDatabase } = require('./db/db');
connectToDatabase();

const loginRouter = require('./routes/loginRouter');
app.use(loginRouter);



// by Admin
const memberSettingByAdminRouter = require('./routes/byAdmin/settingRoutes/memberSettingRouter');
app.use(memberSettingByAdminRouter);

const labSettingByAdminRouter = require('./routes/byAdmin/settingRoutes/labSetting/labSettingRouter');
app.use(labSettingByAdminRouter);

const paymentRecordByAdminRouter = require('./routes/byAdmin/settingRoutes/labSetting/paymentRecordRouter');
app.use(paymentRecordByAdminRouter);

const equipmentSettingByAdminRouter = require('./routes/byAdmin/settingRoutes/equipmentSettingRouter');
app.use(equipmentSettingByAdminRouter);

const soyalByAdminRouter = require('./routes/byAdmin/soyal/soyalRouter');
app.use(soyalByAdminRouter);

// by SuperUser
const equipmentSettingBySuperUserRouter = require('./routes/bySuperUser/settingRoutes/equipmentSettingRouter');
app.use(equipmentSettingBySuperUserRouter);

// by User
const profileRouter = require('./routes/byUser/profileRouter');
app.use(profileRouter);

const labSettingByUserRouter = require('./routes/byUser/settingRoutes/labSetting/labSettingRouter');
app.use(labSettingByUserRouter);

const paymentRecordByUserRouter = require('./routes/byUser/settingRoutes/labSetting/paymentRecordRouter');
app.use(paymentRecordByUserRouter );

const reservationByUserRouter = require('./routes/byUser/ReservationRouter');
app.use(reservationByUserRouter)

const reservationRecordByUserRouter = require('./routes/byUser/settingRoutes/reservationRecordRouter');
app.use(reservationRecordByUserRouter)

const cloudByUserRouter = require('./routes/byUser/cloudRouter');
app.use(cloudByUserRouter)


// global
const settingsRouter = require('./routes/settingsRouter');
app.use(settingsRouter) 

app.listen(3007,()=>{
    console.log('server is running on port 3007')
})

process.on('SIGINT', function() {
    disconnectFromDatabase();
    process.exit(0);
});

// 避免系統中斷
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});