
const webpush = require("web-push");
const keys = webpush.generateVAPIDKeys();
console.log(keys);

/*
{
  publicKey: 'BDaELLgGYNHLi1choUSCQFtfKmP56DV1f7TJunGM_dqPRgQosEoflD4xEiLYG4DTypK4DWmdZ5H27XthqyYRm0g',
  privateKey: 'aI-x_n1yc2oGwQ_yerbpr-ST86zOg5hdQjfMlOlbOUw'
}
*/