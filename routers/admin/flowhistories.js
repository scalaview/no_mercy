var express = require('express');
var admin = express.Router();
var models  = require('../../models')
var helpers = require("../../helpers")
var async = require("async")
var _ = require('lodash')
var errHtmlRespone = helpers.errHtmlRespone

admin.get("/flowhistories", function(req, res){
  var result,
      customer = res.locals.customer;
  async.waterfall([function(next) {
    var params = {}
    if(!customer.isAdmin()){
      params = _.merge(params, { customerId: customer.id })
    }else if(req.query.customerId !== undefined && req.query.customerId.present()){
      params = _.merge(params, { customerId: req.query.customerId })
    }
    if(req.query.type !== undefined && req.query.type.present()){
      params = _.merge(params, { type: req.query.type })
    }
    if(req.query.typeId !== undefined && req.query.typeId.present()){
      params = _.merge(params, { typeId: req.query.typeId.toI() })
    }
    if(req.query.state !== undefined && req.query.state.present()){
      params = _.merge(params, { state: req.query.state })
    }
    models.FlowHistory.findAndCountAll({
      where: params,
      limit: req.query.perPage || 15,
      offset: helpers.offset(req.query.page, req.query.perPage || 15),
      order: [
        ['createdAt', 'DESC']
      ]
    }).then(function(flowhistories){
      result = flowhistories
      next(null, flowhistories.rows)
    })
  }, function(flowhistories, outnext) {
    async.map(flowhistories, function(flowHistory, next) {
      flowHistory.getCustomer().then(function(customer) {
        flowHistory.customer = customer
        next(null, flowHistory)
      }).catch(function(err) {
        next(err)
      })
    }, function(err, flowhistories) {
      if(err){
        outnext(err)
      }else{
        outnext(null, flowhistories)
      }
    })
  }, function(flowhistories, outnext) {
    async.map(flowhistories, function(flowHistory, next) {
      if(flowHistory.getSource()){
        flowHistory.getSource().then(function(source) {
          console.log(source)
            if(source){
              switch(source.className()){
                case "Order":
                  flowHistory.source = source
                  break;
              }
              next(null, flowHistory)
            }
        }).catch(function(err) {
          next(err)
        })
      }else{
        next(null, flowHistory)
      }
    }, function(err, flowhistories) {
      if(err){
        outnext(err)
      }else{
        outnext(null, flowhistories)
      }
    })
  }, function(flowhistories, next){
    models.Customer.findAll({
      attributes: ["id", "username"]
    }).then(function(customers) {
      var customerCollection = []
      for (var i = 0; i < customers.length; i++) {
        customerCollection.push( [customers[i].id, customers[i].username] )
      };
      next(null, flowhistories, customerCollection)
    }).catch(function(err) {
      next(err)
    })
  }], function(err, flowhistories, customerCollection) {
    if(err){
      errHtmlRespone(err, res)
    }else{
      var customerOptions = { name: 'customerId', class: "select2 col-lg-12 col-xs-12", includeBlank: true },
          stateOptions = { name: 'state', class: 'select2 col-xs-12 col-lg-12', includeBlank: true },
          stateCollection = [ [models.FlowHistory.STATE.ADD, "增加"], [models.FlowHistory.STATE.REDUCE, "减少"] ],
          typeOptions = { name: 'type', class: 'select2 col-xs-12 col-lg-12', includeBlank: true },
          typeCollection = [ ["Order", "流量订单"] ]

      result.rows = flowhistories
      result = helpers.setPagination(result, req)
      res.render('admin/flowhistories/index', {
        flowhistories: result,
        query: req.query,
        customerCollection: customerCollection,
        customerOptions: customerOptions,
        stateCollection: stateCollection,
        stateOptions: stateOptions,
        typeCollection: typeCollection,
        typeOptions: typeOptions
      })
    }
  })
})


module.exports = admin;