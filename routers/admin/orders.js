var express = require('express');
var admin = express.Router();
var models  = require('../../models')
var helpers = require("../../helpers")
var async = require("async")
var _ = require('lodash')
var errHtmlRespone = helpers.errHtmlRespone

admin.get("/orders", function(req, res) {
  var result,
      customer = req.customer

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


admin.get("/orders/:id", function(req, res) {
  async.waterfall([function(next) {
    models.Order.findById(req.params.id).then(function(order) {
      next(null, order)
    }).catch(function(err) {
      next(err)
    })
  }, function(order, next) {
    models.Customer.findById(order.customerId).then(function(customer) {
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


module.exports = admin;