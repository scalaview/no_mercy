request = require("request")
models = require("../models")
async = require("async");
Ch = require("../recharger").ChongRecharger
var helpers = require(process.env.PWD + "/helpers")


function xh() {
  var options = {
      uri: "http://localhost:3008/xh_callback",
      method: 'POST',
      json: {
          "notify_type": "recharge_result",
          "errcode": 0,
          "errmsg": "测试请求",
          "order": {
              "transaction_id": "201504210952082292343482",
              "user_order_id": "201504210952123",
              "number": 15876598724,
              "product_id": "2_10",
              "recharge_fee": "3.00",
              "deduction_fee": "3.00",
              "status": 4,
              "msg": "success"
          }
      }
    }
  return new Promise(function(rvo, rej){
    request(options, function (error, res) {
      if (!error && res.statusCode == 200) {
        rvo(res.body)
      }else{
        rej(error)
      }
    });
  });
}


xh().then(function(data){
  console.log(data)
}).catch(function(err){
  console.log(err)
})