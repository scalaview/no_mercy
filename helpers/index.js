var fs = require('fs')
var path = require('path')
var config = require("../config")
var moment = require('moment')
var _ = require('lodash')
var handlebars = require('handlebars')
var models  = require('../models')
var async = require("async")
var crypto = require('crypto')


String.prototype.htmlSafe = function(){
  return new handlebars.SafeString(this.toString())
}

String.prototype.renderTemplate = function(options){
  if(!this.compileTemplate){
    this.compileTemplate = handlebars.compile(this.toString())
  }
  return this.compileTemplate(options)
}

String.prototype.format = String.prototype.renderTemplate

String.prototype.capitalize = function () {
  return this.toString()[0].toUpperCase() + this.toString().slice(1);
}

String.prototype.present = function(){
  if(this !== undefined){
    if(this instanceof Array){
      return this.length > 0
    }else{
      return (this.toString() !== undefined) && (this.toString() !== '')
    }
  }
}

String.prototype.toI = function(){
  try{
    return parseInt(this.toString())
  }catch(e){
    return this.toString()
  }
}

Array.prototype.compact = function (array) {
  if(this instanceof Array && array == undefined){
    array = this
  }

  var index = -1,
      length = array ? array.length : 0,
      resIndex = -1,
      result = [];

  while (++index < length) {
    var value = array[index];
    if (value !== undefined && value !== null && value !== '' ) {
      result[++resIndex] = value;
    }
  }
  return result;
}

Array.prototype.eachSlice = function (size){
  this.arr = []
  for (var i = 0, l = this.length; i < l; i += size){
    this.arr.push(this.slice(i, i + size))
  }
  return this.arr
};

Date.prototype.begingOfDate = function(){
  this.setHours(0,0,0,0);
  return this
}

Date.prototype.endOfDate = function(){
  this.setHours(23,59,59,999);
  return this
}

function compact(obj){
  if(obj !== undefined && obj !== null){
    if(typeof obj === 'string'){
      return (obj !== '')
    }else if( obj instanceof Array){
      var result = []
      if((array = obj.compact()).length > 0){
        for (var i = 0; i < array.length; i++) {
          var data = array[i]
          var value = compact(array[i])
          if( value instanceof Array ){
            result.push(value)
          }else if(value){
            result.push(data)
          }
        };
        return result.compact()
      }
    }else if( typeof obj === 'object' ){
      for(var key in obj){
        var value = compact(obj[key])
        if(!value){
           delete obj[key]
        }else if(value instanceof Array){
          obj[key] = value
        }
      }
      return (Object.keys(obj).length > 0)
    }else{
      return true
    }
  }
}



exports.strftime = function(dateTime, format){
  var result = moment()
  if(dateTime){
    result = moment(dateTime)
  }
  if( typeof format === 'string'){
    return result.format(format)
  }else{
    return result.format('YYYY-MM-DD HH:mm:ss')
  }
}

exports.randomInt = function(){
  Math.round((new Date().valueOf() * Math.random()))
}



exports.errRespone = function(err, res){
  console.log(err.message)
  var errcode = parseInt(err.message)
  var re = {errcode: errcode}
  switch(errcode)
  {
  case 50001:
    re['errmsg']= "client_id client_secret或者grant_type参数有误"
    break;
  case 50002:
    re['errmsg']= "client_id或者client_secret参数有误"
    break;
  case 50003:
    re['errmsg']= "access_token、sign、product_id或者phone参数有误"
    break;
  case 50004:
    re['errmsg']= "token失效"
    break;
  case 50005:
    re['errmsg']= "签名有误"
    break;
  case 50006:
    re['errmsg']= "product_id参数有误"
    break;
  case 50007:
    re['errmsg']= "用户重复订购，无法充值"
    break;
  case 50008:
    re['errmsg']= "用户余额不足"
    break;
  case 50009:
    re['errmsg']= "access_toke参数有误或者已过期"
    break;
  case 50010:
    re['errmsg']= "access_token、sign或者order_id参数有误"
    break;
  case 50011:
    re['errmsg']= "订单不存在"
    break;
  case 50012:
    re['errmsg']= "access_token参数有误"
    break;
  case 50013:
    re['errmsg']= "access_token、sign、start_time、end_time或者page参数有误"
    break;
  case 50014:
    re['errmsg']= "充值服务错误"
    break;
  case 50015:
    re['errmsg']= "更新状态失败"
    break;
  default:
    re['errmsg']= "充值服务错误，请联系客服"
    break;
  }
  res.json(re)
}

exports.errHtmlRespone = function(err, res){
  console.log(err)
  var errcode = 0
  try{
    errcode = parseInt(err.message)
  }catch(e){}
  switch(errcode){
  case 40001:
    //没有权限
    res.render("no_permission")
    break;
  case 404:
    res.send(404)
    break;
  default:
    res.send(500)
    break;
  }
}

exports.adminOnly = function(req, res, next){
  if(req.customer && req.customer.idAdmin()){
    next()
  }else{
    exports.errHtmlRespone(new Error(40001), res)
  }
}

exports.requireLogin = function(req, res, next) {
  if(process.env.NODE_ENV == "development"){
    req.session.customer_id = 1
  }
  var url = req.originalUrl
  var encodeUrl = new Buffer(url).toString('base64');

  if (req.session.customer_id) {
    models.Customer.findOne({ where: { id: req.session.customer_id } }).then(function(customer) {
      if(customer){
        req.customer = customer
        next();
      }else{
        res.redirect("/admin/login?to=" + encodeUrl);
      }
    }).catch(function(err){
      exports.errRespone(err, res)
    })
  } else {
    res.redirect("/admin/login?to=" + encodeUrl);
  }
}

exports.requireAuth = function(req, res, next) {
  if(process.env.NODE_ENV == "development"){
    models.Customer.findOne({
        where: {
          id: 2
        }
    }).then(function(customer){
      if(customer){
        var now = (new Date()).getTime()
        if(customer.expires_in && customer.expires_in.getTime() > (now + 30000) && customer.access_token){
          req.customer = customer
          next()
        }else{
          customer.generateAccessToken().then(function(customer){
            req.customer = customer
            next()
          }).catch(function(err){
            exports.errRespone(err, req)
          })
        }
      }else{
        exports.errRespone(new Error(50002), req)
      }
    }).catch(function(err){
      exports.errRespone(err, req)
    })
    return
  }
  var body = req.rawBody || req.body,
      client_id = body.client_id,
      client_secret = body.client_secret,
      grant_type = body.grant_type

  if(!(client_id && client_secret && grant_type == "client_credential")) {
    exports.errRespone(new Error(50001), res)
    return
  }
  models.Customer.findOne({
    where: {
      client_id: client_id,
      client_secret: client_secret
    }
  }).then(function(customer){
    if(customer){
      var now = (new Date()).getTime()
      if(customer.expires_in && customer.expires_in.getTime() > (now + 30000) && customer.access_token){
        req.customer = customer
        next()
      }else{
        customer.generateAccessToken().then(function(customer){
          req.customer = customer
          next()
        }).catch(function(err){
          exports.errRespone(err, req)
        })
      }
    }else{
      exports.errRespone(new Error(50002), req)
    }
  }).catch(function(err){
    exports.errRespone(err, req)
  })
}



exports.validateToken = function(req, res, next){

  if(process.env.NODE_ENV == "development"){
    models.Customer.findOne({
        where: {
          id: 2
        }
    }).then(function(customer){
      req.customer = customer
      next()
      return
    }).catch(function(err){
      exports.errRespone(err, res)
    })
    return
  }

  var body = req.rawBody || req.body,
      access_token = body.access_token
  if(!access_token){
    exports.errRespone(new Error(50003), res)
    return
  }
   models.Customer.validateToken(models, access_token).then(function(customer){
      if(customer){
        req.customer = customer
        next()
      }else{
        exports.errRespone(new Error(50004), res)
      }
    }).catch(function(err) {
      exports.errRespone(err, res)
    })
}



exports.doCallBack = function(order, errcode, msg, time){
  if(!order.callbackUrl){
    return
  }
  var params = {
      errcode: errcode,
      errmsg: msg
  }
  if(errcode == '0'){
    params["order"] = {
      transaction_id: order.transactionId,
      number: order.phone,
      product_id: order.exchangerId,
      recharge_fee: order.cost
    }
  }

  var options = {
        uri: order.callbackUrl,
        method: "POST",
        qs: params
      }
  console.log("callbackUrl:")
  console.log(options)
  request(options, function (error, res) {
    if (!error && res.statusCode == 200) {
      console.log("callback return")
        console.log(res.body)
        var data = JSON.parse(res.body)
    }else{
    }
  });
}

exports.autoCharge = function(order, product){
  order.autoRecharge(product).then(function(data) {
      console.log(data)
      if(product.type == models.Product.TYPE['曦和流量']){
        if(data.errcode == 0){
          order.updateAttributes({
            state: models.Order.STATE.SUCCESS,
            taskid: data.order.transaction_id,
            message: "充值成功"
          }).then(function(Order){
            exports.doCallBack(order, "0", "充值成功", 3)
          }).catch(function(err) {
            exports.doCallBack(order, "50015", "更新状态失败", 3)
          })
        }else{
          order.updateAttributes({
            state: models.Order.STATE.FAIL,
            message: data.errmsg
          })
          exports.doCallBack(order, "50014", data.errmsg, 3)
        }
      }else{

      }
    }).catch(function(err){
      exports.doCallBack(order, "50015", "更新状态失败", 3)
    })
}

exports.setPagination = function(result, req){
  result.page = req.query.page || 1,
  result.perPage = req.query.perPage || 15,
  result.currentPage = req.query.page || 1
  return result
}

exports.offset = function(page, prePage){
  if(page > 0){
    return (page - 1) * prePage
  }
  return 0
}