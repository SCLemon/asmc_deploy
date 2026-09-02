const { LRUCache } = require('lru-cache');

// token 快取，儲存已驗證過的 token，避免每次請求都要查資料庫
const tokenCache = new LRUCache({
    max: 1000,
    ttl: 1000 * 60 * 15, // 15 分鐘
    updateAgeOnGet: false,
});


module.exports = {
    tokenCache,
};