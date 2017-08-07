var express = require('express');
var admin = express.Router();
var models  = require('../../models')
var helpers = require("../../helpers")
var async = require("async")
var _ = require('lodash')
var errHtmlRespone = helpers.errHtmlRespone
var config = require("../../config")
var request = require("request")

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

admin.post("/extractorder", function(req, res) {
  if(!( req.body.phone !== undefined && req.body.phone.present() && req.body.trafficPlanId !== undefined &&  req.body.trafficPlanId.present() )){
    res.format({
      html: function(){
        res.redirect("/admin/extractorders/new")
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
  async.waterfall([function(next) {
    models.TrafficPlan.findById(req.body.trafficPlanId).then(function(trafficPlan) {
      if(trafficPlan){
        next(null, trafficPlan)
      }else{
        next(new Error("请选择正确的流量包"))
      }
    }).catch(function(err) {
      next(err)
    })
  }, function(trafficPlan, next){
    models.ExtractOrder.build({
      exchangerType: trafficPlan.className(),
      exchangerId: trafficPlan.id,
      phone: req.body.phone,
      cost: req.body.cost,
      value: trafficPlan.value,
      bid: trafficPlan.bid,
      type: trafficPlan.type,
      chargeType: "terminal",
      extend: req.body.extend,
      productType: models.TrafficPlan.PRODUCTTYPE["traffic"]
    }).save().then(function(extractOrder) {
      next(null, extractOrder, trafficPlan)
    }).catch(function(err) {
      next(err)
    })
  }, function(extractOrder, trafficPlan, next){
    autoCharge(extractOrder, trafficPlan, function(err){
      if(err){
        next(err)
      }else{
        next(null, extractOrder, trafficPlan)
      }
    })
  }], function(err, extractOrder, trafficPlan) {
    if(err){
      console.log(err)
      res.format({
        html: function(){
          req.flash('err', err.message)
          res.redirect("/admin/extractorders/new")
          return
        },
        json: function(){
          res.json({
            code: 1,
            msg: err.message
          });
          return
        },
        default: function() {
          res.status(406).send('Not Acceptable');
          return
        }
      });
    }else{
      res.format({
        html: function(){
          req.flash('info', "create success")
          res.redirect("/admin/extractorders/" + extractOrder.id + "/edit")
          return
        },
        json: function(){
          res.json({
            code: 0,
            msg: "成功"
          });
          return
        },
        default: function() {
          res.status(406).send('Not Acceptable');
          return
        }
      });
    }
  })

})


module.exports = admin;