var express = require('express');
var app = express.Router();
var models  = require(process.env.PWD + '/models')
var helpers = require(process.env.PWD + "/helpers")
var async = require("async")
var validateToken = helpers.validateToken
var doCallBack = helpers.doCallBack
var autoCharge = helpers.autoCharge
var errRespone = helpers.errRespone
var request = require("request")

app.post("/flow/recharge/order", validateToken, function(req, res) {
  var body = req.rawBody || req.body,
      phone = body.phone,
      product_id = body.product_id,
      callback_url = body.callback_url,
      user_order_id = body.user_order_id,
      client_id = body.client_id,
      sign = body.sign,
      access_token = body.access_token,
      customer = res.locals.customer

  if(!(phone && product_id && sign && access_token)){
    helpers.errRespone(new Error(50003), res)
    return
  }

  async.waterfall([function(next){
    var signParams = {
      client_id: client_id,
      phone: phone,
      product_id: product_id
    }
    if(callback_url){
      signParams["callback_url"] = callback_url
    }
    if(user_order_id){
      signParams["user_order_id"] = user_order_id
    }
    var _sign = helpers.sign(signParams)
    if(_sign == sign){
      next(null, customer)
    }else{
      next(new Error(50005))
    }
  }, function(customer, next) {
    models.Product.findOne({
      where: {
        id: product_id,
        display: true
      }
    }).then(function(product) {
      if(product){
        next(null, customer, product)
      }else{
        next(new Error(50006))
      }
    })
  }, function(customer, product, next) {
    if(customer.total < product.price){
      next(new Error(50008))
      return
    }
    models.Order.build({
      phone: phone,
      value: product.value,
      providerId: product.providerId,
      province: product.province,
      value: product.value,
      type: product.type,
      bid: product.bid,
      price: product.price,
      purchasePrice: product.purchasePrice,
      customerId: customer.id,
      transactionId: null,
      total: product.price,
      callbackUrl: decodeURIComponent(callback_url),
      userOrderId: user_order_id,
      productId: product.id
    }).save().then(function(order) {
      next(null, customer, product, order)
    }).catch(function(err){
      next(err)
    })
  }, function(customer, product, order, next){
    customer.updateAttributes({
      total: customer.total - order.total
    }).then(function(customer){
      next(null, customer, product, order)
    }).catch(function(err){
      next(err)
    })
  }, function(customer, product, order,next) {
    next(null, customer, product, order)
    autoCharge(order, product)
  }], function(err, customer, product, order){
    if(err){
      errRespone(err, res)
    }else{
      res.json({
        errcode: 0,
        errmsg: "success",
        order: {
          transaction_id: order.transactionId,
          phone: order.phone,
          product_id: order.productId,
          total: order.total
        }
      })
    }
  })
})


app.get("/order/detail", validateToken, function(req, res) {
  var access_token = req.query.access_token,
      sign = req.query.sign,
      order_id = req.query.order_id,
      customer = res.locals.customer

  if(!(access_token && sign && order_id)){
    errRespone(new Error(50010), res)
    return
  }

  async.waterfall([function(customer, next) {
    var signParams = {
      order_id: order_id
    }
    var _sign = helpers.sign(signParams)
    if(_sign == sign){
      next(null, customer)
    }else{
      next(new Error(50005))
    }
  }, function(customer, next) {
    models.Order.findOne({
      where: {
        customerId: customer.id,
        transactionId: order_id
      }
    }).then(function(order) {
      if(order){
        next(null, customer, order)
      }else{
        next(new Error(50011))
      }
    })
  }], function(err, customer, order) {
    if(err){
      errRespone(err, res)
    }else{
      res.json({
        errcode: 0,
        errmsg: "success",
        order: {
          transaction_id: order.transactionId,
          phone: order.phone,
          product_id: order.exchangerId,
          total: order.total,
          created_at: helpers.strftime(order.createdAt),
          state: order.state,
          state_name: order.stateName()
        }
      })
    }
  })
})

app.get("/order/lists", validateToken, function(req, res) {
  var access_token = req.query.access_token,
      sign = req.query.sign,
      start_time = req.query.start_time,
      end_time = req.query.end_time,
      page = req.query.page || 1,
      perPage = 30,
      customer = res.locals.customer

  if(!(access_token && sign && start_time && end_time && page)){
    errRespone(new Error(50013), res)
    return
  }

  async.waterfall([function(customer, next) {
    var signParams = {
      start_time: start_time,
      end_time: end_time,
      page: page
    }
    var _sign = helpers.sign(signParams)
    if(_sign == sign){
      next(null, customer)
    }else{
      next(new Error(50005))
    }
  }, function(customer, next){
    console.log(start_time)
    console.log(end_time)
    models.Order.findAndCountAll({
      where: {
        createdAt: {
          $gt: new Date(parseInt(start_time)),
          $lt: new Date(parseInt(end_time))
        }
      },
      limit: perPage,
      offset: helpers.offset(page, perPage)
    }).then(function(orders){
      next(null, customer, orders)
    }).catch(function(err){
      next(err)
    })
  }, function(customer, orders, pass) {
    async.map(orders.rows, function(order, next) {
      next(null, {
        transaction_id: order.transactionId,
        phone: order.phone,
        product_id: order.productId,
        total: order.total,
        created_at: helpers.strftime(order.createdAt),
        state: order.state,
        state_name: order.stateName()
      })
    }, function(err, ordersJson){
      if(err){
        pass(err)
      }else{
        pass(null, customer, orders, ordersJson)
      }
    })
  }], function(err, customer, orders, ordersJson){
    if(err){
      errRespone(err, res)
    }else{
      res.json({
        errcode: 0,
        errmsg: "success",
        orders: {
          total: orders.count,
          totalPage: (orders.count % perPage) == 0 ? (orders.count / perPage) : parseInt(orders.count / perPage) + 1,
          page: page,
          per_page: perPage,
          lists: ordersJson
        }
      })
    }
  })
})


app.get('/phone/data', validateToken, function(req, res) {
  if(!req.query.phone){
    res.json({ msg: '请输入手机号码', code: 0 })
    return
  }
  request('http://cx.shouji.360.cn/phonearea.php?number=' + req.query.phone).pipe(res)
})



module.exports = app;