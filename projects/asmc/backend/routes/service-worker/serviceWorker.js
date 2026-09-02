const webpush = require("web-push");

const publicKey = 'BDaELLgGYNHLi1choUSCQFtfKmP56DV1f7TJunGM_dqPRgQosEoflD4xEiLYG4DTypK4DWmdZ5H27XthqyYRm0g';
const privateKey = 'aI-x_n1yc2oGwQ_yerbpr-ST86zOg5hdQjfMlOlbOUw'
webpush.setVapidDetails("mailto:blc0000421@gmail.com",publicKey, privateKey);


// 推播訊息
async function pushNotification(title = 'Moruvi', message = '你有一則新通知', url='./', subscription = {}){
    
    const payload = JSON.stringify({ title: title, body: message, url: url });

    try {
      await webpush.sendNotification(subscription, payload);
      return { type:'success', message: `傳送通知成功。`}
    } 
    catch (err) {
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        return { type:'error', message: `傳送通知失敗（${err?.statusCode})。`}
      } 
      else {
        console.log(err)
        return { type:'error', message: `傳送通知失敗（系統異常錯誤)。`}
      }
    }
}

module.exports = {
    pushNotification
};
