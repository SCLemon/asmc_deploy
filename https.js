const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const https = require('https');
const fs = require('fs');
const net = require('net');

const app = express();
const PORT = process.env.PORT || 443;

// ==========================================
// SSL 憑證
// ==========================================

const { originForHttps, keyForHttps } = require('./sslPath.js');

const options = {
    key: fs.readFileSync(path.resolve(__dirname, keyForHttps)),
    cert: fs.readFileSync(path.resolve(__dirname, originForHttps))
};


// ==========================================
// ASMC (3007) Proxy
// ==========================================

const asmcApiProxy = createProxyMiddleware({
    target: 'http://127.0.0.1:3007/api/',
    changeOrigin: true
});

const asmcLoginProxy = createProxyMiddleware({
    target: 'http://127.0.0.1:3007/login/',
    changeOrigin: true
});


// ==========================================
// 1. ASMC API
// ==========================================

app.use('/api/', (req, res, next) => {
    return asmcApiProxy(req, res, next);
});


// ==========================================
// 2. ASMC LOGIN
// ==========================================

app.use('/login/', (req, res, next) => {
    return asmcLoginProxy(req, res, next);
});


// ==========================================
// 3. ACCESS CONTROL Reverse Proxy
//
// 使用方式：
//
// https://sclemon1013.com/access-control/192.168.0.2/
//
//                     ↓
//
// http://192.168.0.2/
//
//
//
// https://sclemon1013.com/access-control/192.168.0.2/api/test
//
//                     ↓
//
// http://192.168.0.2/api/test
// ==========================================

const accessControlProxy = createProxyMiddleware({

    changeOrigin: true,

    // --------------------------------------
    // 根據 URL 裡面的 IP 動態決定 target
    // --------------------------------------

    router: (req) => {

        const match = req.originalUrl.match(
            /^\/access-control\/([^/]+)(\/.*)?$/
        );

        if (!match) {
            console.log(
                '[ACCESS CONTROL] Invalid URL:',
                req.originalUrl
            );

            return 'http://127.0.0.1';
        }

        const ip = match[1];

        console.log('');
        console.log('==========================================');
        console.log('[ACCESS CONTROL]');
        console.log('Client IP :', req.ip);
        console.log('Request   :', req.method, req.originalUrl);
        console.log('Target IP :', ip);
        console.log('Target    :', `http://${ip}`);
        console.log('==========================================');

        return `http://${ip}`;
    },


    // --------------------------------------
    // 把：
    //
    // /access-control/192.168.0.2/api/test
    //
    // 改成：
    //
    // /api/test
    //
    // --------------------------------------

    pathRewrite: (path, req) => {

        const match = req.originalUrl.match(
            /^\/access-control\/[^/]+(\/.*)?$/
        );

        if (!match) {
            return '/';
        }

        const newPath = match[1] || '/';

        console.log(
            '[ACCESS CONTROL] Path Rewrite:',
            path,
            '→',
            newPath
        );

        return newPath;
    },


    // --------------------------------------
    // Proxy 發生錯誤
    // --------------------------------------

    onError: (err, req, res) => {

        console.error('');
        console.error('==========================================');
        console.error('[ACCESS CONTROL ERROR]');
        console.error('Request:', req.method, req.originalUrl);
        console.error('Error  :', err.message);
        console.error('==========================================');
        console.error('');

        if (!res.headersSent) {
            res.status(502).send(
                'Target internal website unavailable.'
            );
        }
    }
});


// ⚠️ 非常重要
// 一定要放在 express.static() 和 app.get('*') 前面

app.use('/access-control/', accessControlProxy);


// ==========================================
// 4. ASMC Static Files
// ==========================================

const asmcStatic = express.static(
    path.join(
        __dirname,
        'projects',
        'asmc',
        'dist'
    )
);

app.use((req, res, next) => {
    return asmcStatic(req, res, next);
});


// ==========================================
// 5. SPA fallback
// ==========================================

app.get('*', (req, res) => {

    return res.sendFile(
        path.join(
            __dirname,
            'projects',
            'asmc',
            'dist',
            'index.html'
        )
    );
});


// ==========================================
// 6. Error Handler
// ==========================================

app.use((err, req, res, next) => {

    console.error(err.stack);

    if (!res.headersSent) {
        res.status(500).send(
            'Something broke!'
        );
    }
});


// ==========================================
// 7. HTTPS Server
// ==========================================

https.createServer(
    options,
    app
).listen(
    PORT,
    '0.0.0.0',
    () => {

        console.log(
            `HTTPS Server is running on port ${PORT}`
        );

        console.log(
            `https://sclemon1013.com/`
        );

        console.log(
            `Access Control Proxy enabled`
        );
    }
);