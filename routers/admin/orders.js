var express = require('express');
var admin = express.Router();
var models  = require('../../models')
var helpers = require("../../helpers")
var async = require("async")
var _ = require('lodash')
var errHtmlRespone = helpers.errHtmlRespone
var config = require("../../config")
var request = require("request")
var errRespone = helpers.errRespone

admin.get("/orders", function(req, res) {
  var result,
      customer = res.locals.customer

  async.waterfall([function(next) {
    var params = {}
    if(!customer.isAdmin()){
      params = _.merge(params, {customerId: customer.id })
    }
    if(req.query.phone !== undefined && req.query.phone.present()){
      params = _.merge(params, { phone: req.query.phone } )
    }

    if(req.query.state !== undefined && req.query.state.present()){
      params = _.merge(params, { state: req.query.state } )
    }
    if(req.query.productId !== undefined && req.query.productId.present()){
      params = _.merge(params, { productId: req.query.productId } )
    }

    models.Order.findAndCountAll({
      where: params,
      order: [
        ['updatedAt', 'DESC']
      ],
      limit: req.query.perPage || 15,
      offset: helpers.offset(req.query.page, req.query.perPage || 15),
    }).then(function(orders){
      result = orders
      next(null, orders.rows)
    }).catch(function(err){
      next(err)
    })
  }, function(orders, outnext) {
    if(customer.isAdmin()){
      async.map(orders, function(order, next){
        models.Customer.findById(order.customerId).then(function(customer) {
          order.customer = customer
          next(null, order)
        }).catch(function(err){
          next(err)
        })
      }, function(err, orders) {
        if(err){
          outnext(err)
        }else{
          outnext(null, orders)
        }
      })
    }else{
      outnext(null, orders)
    }
  }, function(orders, outnext){
    async.map(orders, function(order, next){
      order.getProduct().then(function(product){
        order.product = product
        next(null, order)
      }).catch(function(err){
        next(err)
      })
    }, function(err, orders) {
      if(err){
        outnext(err)
      }else{
        outnext(null, orders)
      }
    })
  }], function(err, orders) {
    if(err){
      errHtmlRespone(err, res)
    }else{
      var stateOptions = { name: 'state', id: 'state', class: 'select2 col-lg-12 col-xs-12', includeBlank: true },
        stateCollection = []

      for(var key in models.Order.STATE){
        stateCollection.push([ models.Order.STATE[key], key ])
      }
      result.rows = orders
      result = helpers.setPagination(result, req)
      res.render("admin/orders/index", {
        orders: result,
        stateOptions: stateOptions,
        stateCollection: stateCollection,
        query: req.query
      })
    }
  })
})


admin.get("/orders/:id/edit", function(req, res) {
  async.waterfall([function(next) {
    models.Order.findById(req.params.id).then(function(order) {
      next(null, order)
    }).catch(function(err) {
      next(err)
    })
  }, function(order, next) {
    order.getCustomer().then(function(customer) {
      order.customer = customer
      next(null, order)
    }).catch(function(err){
      next(err)
    })
  }], function(err, order){
    if(err){
      errHtmlRespone(err, res)
    }else{
      res.render("admin/orders/show", { order: order })
    }
  })
})


admin.get("/orders/new", function(req, res) {
  var customer = res.locals.customer
  async.waterfall([function(next){
    var options = {
      uri: "http://localhost:"+config.port+"/api/v1/auth/token",
      method: 'POST',
      json: {
        client_id: customer.client_id,
        client_secret: customer.client_secret,
        grant_type: "client_credential"
      }
    }
    request(options, function (error, res) {
      if (!error && res.statusCode == 200) {
        var data = res.body
        if(data.errcode === 0){
          var now = (new Date()).getTime() + data.expires_in * 1000
          next(null, {accessToken: data.access_token, expireTime: now})
        }else{
          next(new Error(data.errmsg))
        }
      }else{
        next(error)
      }
    });
  }], function(err, token){
    res.render("admin/orders/new", { token: token})
  })
})

admin.post("/order", function(req, res) {
  var customer = res.locals.customer
  if(!( req.body.phone !== undefined && req.body.phone.present() && req.body.product_id !== undefined &&  req.body.product_id.present() )){
    res.format({
      html: function(){
        res.redirect("/admin/orders/new")
        return
      },
      json: function(){
        res.json({
          code: 1,
          msg: "参数错误"
        });
        return
      },
      default: function() {
        res.status(406).send('Not Acceptable');
        return
      }
    });
    return
  }
  var options = {
    uri: "http://localhost:"+config.port+"/api/v1/flow/recharge/order",
    method: 'POST'
  }
  var signParams = {
    client_id: customer.client_id,
    phone: req.body.phone,
    product_id: req.body.product_id
  }
  signParams['sign'] = helpers.sign(signParams)
  signParams['access_token'] = customer.access_token
  options["json"] = signParams
  request(options, function (error, response) {
    if (!error && response.statusCode == 200) {
      res.json(response.body)
    }else{
      errRespone(error, res)
    }
  });
})


module.exports = admin;