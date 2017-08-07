var express = require('express');
var app = express.Router();
var models  = require(process.env.PWD + '/models')
var helpers = require(process.env.PWD + "/helpers")
var async = require("async")
var doCallBack = helpers.doCallBack
var autoCharge = helpers.autoCharge
var errRespone = helpers.errRespone


function confirmOrder(params, isDone, msg, pass){
  async.waterfall([function(next) {
    models.Order.findOne({
      where: params
    }).then(function(order) {
      if(order){
        next(null, order)
      }else{
        pass(null)
        return
      }
    }).catch(function(err) {
      next(err)
    })
  }, function(order, next){
    order.getCustomer().then(function(customer) {
      next(null, order, customer)
    }).catch(function(err) {
      next(err)
    })
  }, function(order, customer, next){
      console.log("done")
    var status = models.Order.STATE.FAIL
    if(isDone){
      status = models.Order.STATE.FINISH
      next(null, order, status)
    }else{
      if(customer){
        customer.refundTotal(models, order, msg).then(function(flowHistory) {
          next(null, order, status)
        }, function(err) {
          next(err)
        })
      }else{
        next(null, order, status)
      }
    }
  }, function(order, status, next) {
    order.updateAttributes({
      state: status
    }).then(function(order) {
      next(null, order)
    }).catch(function(err) {
      next(err)
    })
  }, function(order, next){
    doCallBack(order, isDone ? 0 : 1, msg, 3)
    next(null)
  }], function(err, order){
      if(err){
        console.log(err)
      }
      pass(null)
  });
}


app.post("/callback_url", function(req, res){
  res.json({ok: 1})
})

/*
{
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
*/
app.post("/xh_callback", function(req, res){
  var body = req.rawBody || req.body
  console.log(body)
  if(body.errcode == 0){
    var order = body.order
    async.waterfall([function(next){
      confirmOrder({
        state: models.Order.STATE.SUCCESS,
        taskid: order.transaction_id,
        phone: order.number
      }, order.status !== 2, order.msg, next)
    }], function(err){
      res.json({ok: 1})
    })
  }
})

module.exports = app;