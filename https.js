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
    key: fs.readFileSync(
        path.resolve(__dirname, keyForHttps)
    ),

    cert: fs.readFileSync(
        path.resolve(__dirname, originForHttps)
    )
};


// ==========================================
// ASMC (3007) API Proxy
// ==========================================

const asmcApiProxy = createProxyMiddleware({
    target: 'http://127.0.0.1:3007/api/',
    changeOrigin: true
});


// ==========================================
// ASMC (3007) LOGIN Proxy
// ==========================================

const asmcLoginProxy = createProxyMiddleware({
    target: 'http://127.0.0.1:3007/login/',
    changeOrigin: true
});


// ==========================================
// ASMC API
// ==========================================

app.use('/api/', (req, res, next) => {

    console.log(
        '[ASMC API]',
        req.method,
        req.originalUrl
    );

    return asmcApiProxy(req, res, next);
});


// ==========================================
// ASMC LOGIN
// ==========================================

app.use('/login/', (req, res, next) => {

    console.log(
        '[ASMC LOGIN]',
        req.method,
        req.originalUrl
    );

    return asmcLoginProxy(req, res, next);
});


// ==========================================
// ACCESS CONTROL
//
// 動態 IP Reverse Proxy
//
// /access-control/192.168.0.2/
//        ↓
// http://192.168.0.2/
//
// /access-control/192.168.0.5/
//        ↓
// http://192.168.0.5/
//
// /access-control/192.168.0.123/api/test
//        ↓
// http://192.168.0.123/api/test
// ==========================================

const accessControlProxy = createProxyMiddleware({

    // 這裡只需要一個預設 target
    // 實際 target 由 router 動態決定
    target: 'http://127.0.0.1',

    changeOrigin: true,


    // ======================================
    // 動態決定 Proxy Target
    // ======================================

    router: (req) => {

        const match = req.originalUrl.match(
            /^\/access-control\/([^/]+)(\/.*)?$/
        );

        if (!match) {

            console.error(
                '[ACCESS CONTROL] Invalid URL:',
                req.originalUrl
            );

            return 'http://127.0.0.1';
        }

        const ip = match[1];

        console.log('');
        console.log('==========================================');
        console.log('[ACCESS CONTROL REQUEST]');
        console.log('Method      :', req.method);
        console.log('Original URL:', req.originalUrl);
        console.log('Target IP   :', ip);
        console.log('Target      :', `http://${ip}`);
        console.log('==========================================');
        console.log('');

        return `http://${ip}`;
    },


    // ======================================
    // 移除 /access-control/<ip>
    // ======================================

    pathRewrite: (path, req) => {

        const match = req.originalUrl.match(
            /^\/access-control\/[^/]+(\/.*)?$/
        );

        if (!match) {

            console.error(
                '[ACCESS CONTROL] Path rewrite failed:',
                req.originalUrl
            );

            return '/';
        }

        const newPath = match[1] || '/';

        console.log(
            '[ACCESS CONTROL PATH]',
            path,
            '=>',
            newPath
        );

        return newPath;
    },


    // ======================================
    // Proxy Request
    // ======================================

    onProxyReq: (proxyReq, req, res) => {

        console.log(
            '[ACCESS CONTROL → TARGET]',
            req.method,
            req.originalUrl,
            '=>',
            proxyReq.path
        );
    },


    // ======================================
    // Proxy Response
    // ======================================

    onProxyRes: (proxyRes, req, res) => {

        console.log(
            '[ACCESS CONTROL ← TARGET]',
            proxyRes.statusCode,
            req.method,
            req.originalUrl
        );
    },


    // ======================================
    // Proxy Error
    // ======================================

    onError: (err, req, res) => {

        console.error('');
        console.error(
            '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'
        );

        console.error(
            '[ACCESS CONTROL PROXY ERROR]'
        );

        console.error(
            'Method:',
            req.method
        );

        console.error(
            'URL:',
            req.originalUrl
        );

        console.error(
            'Error:',
            err.message
        );

        console.error(
            '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'
        );

        console.error('');

        if (!res.headersSent) {

            res.status(502).send(
                'Access Control target unavailable.'
            );
        }
    }
});


// ==========================================
// ACCESS CONTROL ROUTE
//
// ⚠️ 必須放在 Static 前面
// ==========================================

app.use(
    '/access-control/',
    accessControlProxy
);


// ==========================================
// ASMC Static Files
// ==========================================

const asmcStatic = express.static(
    path.join(
        __dirname,
        'projects',
        'asmc',
        'dist'
    )
);


// ==========================================
// Static Middleware
// ==========================================

app.use(
    (req, res, next) => {

        return asmcStatic(
            req,
            res,
            next
        );
    }
);


// ==========================================
// SPA Fallback
// ==========================================

app.get('*', (req, res) => {

    console.log(
        '[ASMC SPA]',
        req.method,
        req.originalUrl
    );

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
// Express Error Handler
// ==========================================

app.use(
    (err, req, res, next) => {

        console.error('');
        console.error(
            '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'
        );

        console.error(
            '[EXPRESS ERROR]'
        );

        console.error(
            'URL:',
            req.originalUrl
        );

        console.error(
            'ERROR:',
            err.stack
        );

        console.error(
            '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'
        );

        console.error('');

        if (!res.headersSent) {

            res.status(500).send(
                'Something broke!'
            );
        }
    }
);


// ==========================================
// HTTPS Server
// ==========================================

https.createServer(
    options,
    app
).listen(
    PORT,
    '0.0.0.0',
    () => {

        console.log('');
        console.log('==========================================');
        console.log('HTTPS Server is running');
        console.log('Port:', PORT);
        console.log('==========================================');

        console.log('');
        console.log('ASMC API:');
        console.log(
            '  /api/*'
        );
        console.log(
            '  -> http://127.0.0.1:3007/api/'
        );

        console.log('');
        console.log('ASMC Login:');
        console.log(
            '  /login/*'
        );
        console.log(
            '  -> http://127.0.0.1:3007/login/'
        );

        console.log('');
        console.log('Access Control:');
        console.log(
            '  /access-control/<IP>/*'
        );
        console.log(
            '  -> http://<IP>/*'
        );

        console.log('');
        console.log(
            'Example:'
        );
        console.log(
            '  https://sclemon1013.com/access-control/192.168.0.2/'
        );
        console.log(
            '  -> http://192.168.0.2/'
        );

        console.log('');
        console.log(
            '  https://sclemon1013.com/access-control/192.168.0.5/'
        );
        console.log(
            '  -> http://192.168.0.5/'
        );

        console.log('');
        console.log(
            'https://sclemon1013.com/'
        );

        console.log(
            '=========================================='
        );

        console.log('');
    }
);