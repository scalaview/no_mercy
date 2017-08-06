'use strict';
var fs = require('fs')
var path = require('path')
var config = require("../config")
var moment = require('moment')
var _ = require('lodash')
var handlebars = require('handlebars')
var models  = require('../models')
var async = require("async")
var crypto = require('crypto')
var Promise = require("bluebird");
var request = require("request")

String.prototype.htmlSafe = function(){
  return new handlebars.SafeString(this.toString())
}

String.prototype.renderTemplate = function(options){
  return handlebars.compile(this.toString())(options)
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
  return Math.round((new Date().valueOf() * Math.random()))
}

exports.formatQueryParams = function(params, urlencode){
  var keys = Object.keys(params),
      i, len = keys.length;
  var tmpParams = []
  keys.sort();

  for (i = 0; i < len; i++) {
    var key = keys[i],
        value = params[key]
    if(urlencode){
      value = encodeURI(value)
    }
    tmpParams.push(key + "=" + value)
  }
  return tmpParams.join("&")
}

exports.sign = function(params){
  var formatParams = exports.formatQueryParams(params, false),
      sha1Str = crypto.createHash('sha1').update(formatParams).digest('hex')
  return sha1Str.toUpperCase()
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
    res.render("no_permission", { layout: false });
    return;
  case 404:
    res.send(404)
    break;
  default:
    res.send(500)
    break;
  }
}

exports.adminOnly = function(req, res, next){
  if(res.locals.customer && res.locals.customer.isAdmin()){
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
        res.locals.customer = customer
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
          res.locals.customer = customer
          next()
        }else{
          customer.generateAccessToken().then(function(customer){
            res.locals.customer = customer
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
        res.locals.customer = customer
        next()
      }else{
        customer.generateAccessToken().then(function(customer){
          res.locals.customer = customer
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
      res.locals.customer = customer
      next()
      return
    }).catch(function(err){
      exports.errRespone(err, res)
    })
    return
  }
  if(req.method == 'GET'){
    var body = req.query
  }else if(req.method == 'POST'){
    var body = req.rawBody || req.body
  }else{
    exports.errRespone(new Error(50003), res)
    return
  }
    var access_token = body.access_token
  if(!access_token){
    exports.errRespone(new Error(50003), res)
    return
  }
   models.Customer.validateToken(models, access_token).then(function(customer){
      if(customer){
        res.locals.customer = customer
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
        json: params
      }
  console.log("callbackUrl:")
  console.log(options)
  var i = 0;
  function _doCallBack(options, order){
    request(options, function (error, res) {
      i++;
      if (!error && res.statusCode == 200) {
        console.log("callback return")
        console.log(res.body)
        order.updateAttributes({
          callbackDone: true
        }).then(function(order){
          console.log("finish");
          return
        }).catch(function(err){
          console.log(err);
          return;
        })
      }else if(i<=time){
        setTimeout(function(){
          _doCallBack(options, order)
        }, 3000)
      }
    });
  }
  setTimeout(function(){
    _doCallBack(options, order)
  }, 3000)
}

exports.autoCharge = function(order, product){
  order.autoRecharge(models, product).then(function(data) {
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

exports.pagination = function(result, href){
  if(!result) return;
  function isFirst(){
    return (currentPage == 1)
  }

  function isLast(){
    return currentPage == totalpages
  }

  var source = [
  '<div class="row">',
    '<div class="col-sm-12">',
      '<div class="pull-right dataTables_paginate paging_simple_numbers" id="dataTables-example_paginate">',
        '<ul class="pagination">',
          '{{items}}',
        '</ul>',
      '</div>',
    '</div>',
  '</div>'].join(""),
    item = ['<li class="paginate_button {{ status }} {{disabled}}" tabindex="0">',
              '<a href="{{link}}">{{text}}</a>',
            '</li>'].join(''),
    template = handlebars.compile(source),
    itemTemplate = handlebars.compile(item),

    total = result.count,
    page = result.page,
    perPage = result.perPage,
    totalpages = (total % perPage) == 0 ? (total / perPage) : parseInt(total / perPage) + 1,
    currentPage = parseInt(result.currentPage),
    items = []

  if(total <= perPage){ return }
    var startIndex = (currentPage - 5 > 0) ? currentPage - 5 : 0,
        endIndex = (currentPage + 4 > totalpages) ? totalpages : currentPage + 4

  var data;
  data = { status: 'previous', disabled: isFirst() ? 'disabled' : null, link: isFirst() ? "#" : addParams(href, {page: 1}), text: "首页"  }
  items.push(itemTemplate(data))

  for (var i = startIndex; i < endIndex ; i++) {
    data = { status: (currentPage == (i + 1)) ? "active" : null, link: addParams(href, {page: i+1}), text: (i+1)}
    items.push(itemTemplate(data))
  };

  data = { status: 'next', disabled: isLast() ? 'disabled' : null, link: isLast() ? "#" : addParams(href, {page: totalpages}), text: "尾页"  }
  items.push(itemTemplate(data))

  return template({ items: items.join("").htmlSafe() }).htmlSafe()
}

exports.isChecked = function(checked){
  if(typeof checked === 'boolean'){
    return checked ? "checked" : ""
  }else if(typeof checked === 'string'){
    try{
      return (parseInt(checked) === 1) ? "checked" : ''
    }catch(e){
    }
  }
}

exports.setPagination = function(result, req){
  result.page = req.query.page || 1,
  result.perPage = req.query.perPage || 15,
  result.currentPage = req.query.page || 1
  return result
}

exports.addParams = function(href, params){
  var subFix = '';

  var urlParams = href.split('?')[1],
      originParams = {}
  if(urlParams){
    var queryParams = urlParams.split('&')
    for (var i = 0; i < queryParams.length; i++) {
      var tmp = queryParams[i].split('=')
      if(tmp[1]){
        originParams[tmp[0]] = tmp[1]
      }
    };
  }

  var paramsAll = _.merge(originParams, params)

  for(var key in paramsAll){
    subFix = subFix + '&' + key + '=' + paramsAll[key]
  }

  if(href.indexOf('?') !== -1 ){
    href = href.split('?')[0]
  }
  return (subFix.length > 0) ? href + "?" + subFix.substring(1, subFix.length) : href
}

exports.offset = function(page, prePage){
  if(page > 0){
    return (page - 1) * prePage
  }
  return 0
}

exports.if_eq = function(a, b, opts) {
  if(a == b) // Or === depending on your needs
    return opts.fn(this);
  else
    return opts.inverse(this);
}

exports.ip = function(req){
  return (req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress)
}

exports.css = function() {
  var css = connectAssets.options.helperContext.css.apply(this, arguments);
  return new handlebars.SafeString(css);
};

exports.js = function() {
  var js = connectAssets.options.helperContext.js.apply(this, arguments);
  return new handlebars.SafeString(js);
};


exports.assetPath = function() {
  var assetPath = connectAssets.options.helperContext.assetPath.apply(this, arguments);
  return new handlebars.SafeString(assetPath);
};



exports.htmlSafe = function(html) {
  if(html){
    return html.htmlSafe()
  }
}

exports.tipSource = function(source, data){
  if( typeof data === 'string' ){
    return source.format({ text: data }).htmlSafe()
  }else if( data instanceof Array && data.length > 0){
    return source.format({ text: data.join('<br>') }).htmlSafe()
  }else if( typeof data === 'object' && data.length > 0 ){
    var html = []
    for(var key in data){
      html.push( data[key] )
    }
    return source.format({ text: html.join('') }).htmlSafe()
  }
}

exports.successTips = function(info){
  var source = ['<div class="alert alert-success alert-dismissable">',
                  '<button type="button" class="close" data-dismiss="alert" aria-hidden="true">×</button>',
                  '{{text}}',
                '</div>'].join('')
  return exports.tipSource(source, info)
}

exports.errTips = function(err) {
  var source = ['<div class="alert alert-danger alert-dismissable">',
                  '<button type="button" class="close" data-dismiss="alert" aria-hidden="true">×</button>',
                  '{{text}}',
                '</div>'].join('')
  return exports.tipSource(source, err)
}

exports.selectTag = function(options, collection, selected) {
  var source = [
        '<select {{#if options.style}} style="{{options.style}}" {{/if}} {{#if options.class}} class="{{options.class}}" {{else}} class="col-xs-12 col-lg-12 select2" {{/if}} {{#if options.id}} id="{{options.id}}" {{/if}} {{#if options.name}} name="{{options.name}}" {{/if}} {{#if options.disabled}} disabled {{/if}} >',
        '{{items}}',
        '</select>'
      ].join(""),
      optionSource = '<option {{#if value }} value="{{value}}" {{/if}} {{selected}}>{{name}}</option>',
      template = handlebars.compile(source),
      optionSourceTemplate = handlebars.compile(optionSource),
      selected = selected || '',
      optionHtml = []

  if(collection instanceof Array){
    if(options.includeBlank){
      optionHtml.push(optionSourceTemplate())
    }
    for (var i = 0; i < collection.length ; i++) {
      if(collection[i] instanceof Array){
        var data = { value: collection[i][0].toString(), name: collection[i][1], selected: selected.toString() === collection[i][0].toString() ? "selected" : null }
      }else if(collection[i] instanceof Object){
        var data = { value: collection[i].value.toString(), name: collection[i].name, selected: selected.toString() ===  collection[i].value.toString() ? "selected" : null }
      }
      optionHtml.push(optionSourceTemplate(data))
    };

    var html = template({ options: options,  items: optionHtml.join("").htmlSafe() })
    return html.htmlSafe()
  }else{
    return template({ options: options }).htmlSafe()
  }
}


exports.flowhistorySourceLink = function(source, options){
  if(!source){
    return
  }
  var link = ['<a  {{#if class}} class="{{class}}" {{/if}} {{#if id}} id="{{id}}" {{/if}} {{#if href}} href="{{href}}" {{/if}}>',
                '{{#if text}} {{text}} {{/if}}',
              '</a>'].join("")
  options.text =  source.className() + ": " + source.id

  if(source.className() === "Order"){
    options.href = "/admin/orders/" + source.id + "/edit"
    return link.renderTemplate(options).htmlSafe()
  }else if(source.className() === "Customer"){
    options.href = "/admin/customers/" + source.id
    return link.renderTemplate(options).htmlSafe()
  }
}


exports.amountType = function(type, amount){
  if(type === 1 ){
    return ['<span class="btn-warning">+ ', amount, ' </span> '].join("").htmlSafe()
  }else if(type ===  0){
    return ['<span class="btn-info">- ', amount, ' </span> '].join("").htmlSafe()
  }
}


