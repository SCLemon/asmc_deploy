const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const https = require('https');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 443;

// 載入 SSL 憑證
const { originForHttps, keyForHttps } = require('./sslPath.js');

const options = {
    key: fs.readFileSync(path.resolve(__dirname, keyForHttps)),
    cert: fs.readFileSync(path.resolve(__dirname, originForHttps))
};

// ==========================================
// 【核心修正】為了解決 Express 切除前綴的問題
// 這裡將 3007 與 3008 的 /api/ 和 /login/ 代理全數分開建立
// 並在 target 尾端補上斜線，確保路徑拼接（Compensation）絕對正確
// ==========================================

// --- asmc (3007) 代理配置 ---
const asmcApiProxy = createProxyMiddleware({
    target: 'http://127.0.0.1:3007/api/',
    changeOrigin: true
});

const asmcLoginProxy = createProxyMiddleware({
    target: 'http://127.0.0.1:3007/login/',
    changeOrigin: true
});


// ==========================================
// 【路由代理與多網域分流中間件】
// ==========================================

// 1. 處理所有 /api/ 開頭的請求
app.use('/api/', (req, res, next) => {
    return asmcApiProxy(req, res, next);
});

// 2. 處理所有 /login/ 開頭的請求
app.use('/login/', (req, res, next) => {
    return asmcLoginProxy(req, res, next);
});


// ==========================================
// 【靜態檔案與 SPA 萬用路由處理】
// ==========================================

// 靜態檔案路徑定義
const asmcStatic = express.static(path.join(__dirname, 'projects', 'asmc', 'dist'));

// 當請求不是 /api/ 或 /login/ 時，會流到這裡讀取前端打包檔案
app.use((req, res, next) => {
    return asmcStatic(req, res, next);
});

// 萬用路由：針對 Hash 模式的根路徑 `/` 或前端重新整理時，正確回傳 index.html
app.get('*', (req, res) => {
    return res.sendFile(path.join(__dirname, 'projects', 'asmc', 'dist', 'index.html'));
});


// ==========================================
// 【錯誤處理與伺服器啟動】
// ==========================================

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

https.createServer(options, app).listen(PORT, '0.0.0.0', () => {
    console.log(`HTTPS Server is running on port ${PORT}`);
});