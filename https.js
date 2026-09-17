const express = require('express');
const {
    createProxyMiddleware
} = require('http-proxy-middleware');

const path = require('path');
const https = require('https');
const fs = require('fs');
const net = require('net');

const app = express();

const PORT = process.env.PORT || 443;


// ============================================================
// SSL
// ============================================================

const {
    originForHttps,
    keyForHttps
} = require('./sslPath.js');

const options = {
    key: fs.readFileSync(
        path.resolve(__dirname, keyForHttps)
    ),

    cert: fs.readFileSync(
        path.resolve(__dirname, originForHttps)
    )
};


// ============================================================
// ASMC API Proxy
//
// Browser:
//   https://sclemon1013.com/api/xxx
//
// ↓
//
// Local:
//   http://127.0.0.1:3007/api/xxx
// ============================================================

const asmcApiProxy = createProxyMiddleware({

    target: 'http://127.0.0.1:3007',

    changeOrigin: true,

    pathRewrite: {
        '^/api': '/api'
    },

    on: {

        proxyReq: (proxyReq, req, res) => {

            console.log(
                '[ASMC API →]',
                req.method,
                req.originalUrl,
                '=>',
                proxyReq.path
            );

        },

        proxyRes: (proxyRes, req, res) => {

            console.log(
                '[ASMC API ←]',
                proxyRes.statusCode,
                req.method,
                req.originalUrl
            );

        },

        error: (err, req, res) => {

            console.error(
                '[ASMC API ERROR]',
                req.method,
                req.originalUrl,
                err.message
            );

            if (!res.headersSent) {

                res
                    .status(502)
                    .send('ASMC API unavailable.');

            }

        }

    }

});

app.use(
    '/api/',
    asmcApiProxy
);


// ============================================================
// ASMC LOGIN Proxy
//
// Browser:
//   https://sclemon1013.com/login/xxx
//
// ↓
//
// Local:
//   http://127.0.0.1:3007/login/xxx
// ============================================================

const asmcLoginProxy = createProxyMiddleware({

    target: 'http://127.0.0.1:3007',

    changeOrigin: true,

    pathRewrite: {
        '^/login': '/login'
    },

    on: {

        proxyReq: (proxyReq, req, res) => {

            console.log(
                '[ASMC LOGIN →]',
                req.method,
                req.originalUrl,
                '=>',
                proxyReq.path
            );

        },

        proxyRes: (proxyRes, req, res) => {

            console.log(
                '[ASMC LOGIN ←]',
                proxyRes.statusCode,
                req.method,
                req.originalUrl
            );

        },

        error: (err, req, res) => {

            console.error(
                '[ASMC LOGIN ERROR]',
                req.method,
                req.originalUrl,
                err.message
            );

            if (!res.headersSent) {

                res
                    .status(502)
                    .send('ASMC Login unavailable.');

            }

        }

    }

});

app.use(
    '/login/',
    asmcLoginProxy
);


// ============================================================
// ACCESS CONTROL
//
// 使用方式:
//
// https://sclemon1013.com/access-control/192.168.0.5/
//
// ↓
//
// http://192.168.0.5/
//
// ------------------------------------------------------------
//
// 例如:
//
// /access-control/192.168.0.5/
//       ↓
// http://192.168.0.5/
//
// /access-control/192.168.0.5/header.htm
//       ↓
// http://192.168.0.5/header.htm
//
// /access-control/192.168.0.5/api/test
//       ↓
// http://192.168.0.5/api/test
// ============================================================


// ------------------------------------------------------------
// IP 驗證
// ------------------------------------------------------------

function isValidAccessIP(ip) {

    // 必須是 IPv4
    if (net.isIP(ip) !== 4) {

        return false;

    }


    const parts = ip
        .split('.')
        .map(Number);


    if (parts.length !== 4) {

        return false;

    }


    // --------------------------------------------------------
    // 這裡限制只能存取 192.168.0.x
    //
    // 如果你之後要允許其他網段，再修改這裡。
    // --------------------------------------------------------

    if (parts[0] !== 192) {

        return false;

    }

    if (parts[1] !== 168) {

        return false;

    }

    if (parts[2] !== 0) {

        return false;

    }

    if (parts[3] < 1 || parts[3] > 254) {

        return false;

    }


    return true;

}


// ------------------------------------------------------------
// Dynamic Access Control Proxy
// ------------------------------------------------------------

const accessControlProxy = createProxyMiddleware({

    // router 會在收到 request 後動態決定真正的 target
    target: 'http://127.0.0.1',

    changeOrigin: true,

    // Forwarded headers
    xfwd: true,

    // HTTP timeout
    timeout: 30000,

    // Proxy timeout
    proxyTimeout: 30000,


    // --------------------------------------------------------
    // Dynamic Target
    // --------------------------------------------------------

    router: (req) => {

        const ip = req.targetIp;

        const target = `http://${ip}`;

        console.log(
            '[ACCESS CONTROL TARGET]',
            target
        );

        return target;

    },


    // --------------------------------------------------------
    // 因為 app.use('/access-control/:ip', ...)
    //
    // Express 已經把：
    //
    // /access-control/192.168.0.5
    //
    // 拿掉
    //
    // 所以 req.url 會直接是：
    //
    // /
    //
    // 或：
    //
    // /header.htm
    //
    // 或：
    //
    // /api/test
    //
    // 不需要再把 IP 從 path 裡面刪一次。
    // --------------------------------------------------------

    pathRewrite: (path, req) => {

        console.log(
            '[ACCESS CONTROL PATH]',
            path,
            '=>',
            path
        );

        return path;

    },


    // --------------------------------------------------------
    // Proxy Events
    // http-proxy-middleware v3 使用 on: {}
    // --------------------------------------------------------

    on: {

        // ----------------------------------------------------
        // Request → Target
        // ----------------------------------------------------

        proxyReq: (proxyReq, req, res) => {

            console.log('');
            console.log(
                '------------------------------------------'
            );

            console.log(
                '[ACCESS CONTROL → TARGET]'
            );

            console.log(
                'Method      :',
                req.method
            );

            console.log(
                'Original URL:',
                req.originalUrl
            );

            console.log(
                'Target IP   :',
                req.targetIp
            );

            console.log(
                'Target      :',
                `http://${req.targetIp}`
            );

            console.log(
                'Proxy Path  :',
                proxyReq.path
            );

            console.log(
                '------------------------------------------'
            );

        },


        // ----------------------------------------------------
        // Response ← Target
        // ----------------------------------------------------

        proxyRes: (proxyRes, req, res) => {

            console.log('');
            console.log(
                '[ACCESS CONTROL ← TARGET]'
            );

            console.log(
                'Status      :',
                proxyRes.statusCode
            );

            console.log(
                'Method      :',
                req.method
            );

            console.log(
                'Original URL:',
                req.originalUrl
            );

            console.log(
                'Target IP   :',
                req.targetIp
            );

            console.log('');

        },


        // ----------------------------------------------------
        // Error
        // ----------------------------------------------------

        error: (err, req, res) => {

            console.error('');
            console.error(
                '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'
            );

            console.error(
                '[ACCESS CONTROL PROXY ERROR]'
            );

            console.error(
                'Method      :',
                req.method
            );

            console.error(
                'Original URL:',
                req.originalUrl
            );

            console.error(
                'Target IP   :',
                req.targetIp
            );

            console.error(
                'Target      :',
                `http://${req.targetIp}`
            );

            console.error(
                'Error       :',
                err.message
            );

            console.error(
                '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'
            );

            console.error('');

            if (!res.headersSent) {

                res
                    .status(502)
                    .send(
                        'Access Control target unavailable.'
                    );

            }

        }

    }

});


// ============================================================
// ACCESS CONTROL Route
//
// 注意：一定要在 static / SPA fallback 前面
// ============================================================

app.use(
    '/access-control/:ip',
    (req, res, next) => {

        const ip = req.params.ip;


        console.log('');
        console.log(
            '=========================================='
        );

        console.log(
            '[ACCESS CONTROL REQUEST]'
        );

        console.log(
            'Method      :',
            req.method
        );

        console.log(
            'Original URL:',
            req.originalUrl
        );

        console.log(
            'Target IP   :',
            ip
        );

        console.log(
            'Target      :',
            `http://${ip}`
        );

        console.log(
            'Proxy Path  :',
            req.url
        );

        console.log(
            '=========================================='
        );


        // ----------------------------------------------------
        // 驗證 IP
        // ----------------------------------------------------

        if (!isValidAccessIP(ip)) {

            console.error(
                '[ACCESS CONTROL] Invalid IP:',
                ip
            );

            return res
                .status(400)
                .send(
                    'Invalid access-control IP.'
                );

        }


        // ----------------------------------------------------
        // 把 IP 傳給 proxy router
        // ----------------------------------------------------

        req.targetIp = ip;


        next();

    },

    accessControlProxy
);


// ============================================================
// Static Files
// ============================================================

const asmcStatic = express.static(
    path.join(
        __dirname,
        'projects',
        'asmc',
        'dist'
    )
);

app.use(
    (req, res, next) => {

        return asmcStatic(
            req,
            res,
            next
        );

    }
);


// ============================================================
// SPA Fallback
// ============================================================

app.get(
    '*',
    (req, res) => {

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

    }
);


// ============================================================
// Error Handler
// ============================================================

app.use(
    (err, req, res, next) => {

        console.error(
            '[EXPRESS ERROR]'
        );

        console.error(
            err.stack
        );

        if (!res.headersSent) {

            res
                .status(500)
                .send(
                    'Something broke!'
                );

        }

    }
);


// ============================================================
// HTTPS Server
// ============================================================

https
    .createServer(
        options,
        app
    )
    .listen(
        PORT,
        '0.0.0.0',
        () => {

            console.log('');
            console.log(
                '=========================================='
            );

            console.log(
                'HTTPS Server is running'
            );

            console.log(
                `Port: ${PORT}`
            );

            console.log(
                'Access Control: ENABLED'
            );

            console.log(
                'Allowed Network: 192.168.0.0/24'
            );

            console.log(
                '=========================================='
            );

            console.log('');

        }
    );