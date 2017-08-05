var express = require('express');
var admin = express.Router();
var models  = require('../../models')
var helpers = require("../../helpers")
var async = require("async")
var _ = require('lodash')
var config = require("../../config")
var errHtmlRespone = helpers.errHtmlRespone
var adminOnly = helpers.adminOnly

admin.get('/customers', adminOnly, function(req, res) {
  var params = {}
  if(req.query.phone !== undefined && req.query.phone.present()){
    params = _.merge(params, { phone: { $like: "%{{phone}}%".format({ phone: req.query.phone }) } })
  }
  if(req.query.id !== undefined && req.query.id.present()){
    params = _.merge(params, { id: req.query.id })
  }
  async.waterfall([function(next){
    models.Customer.findAndCountAll({
      where: params,
      limit: req.query.perPage || 15,
      offset: helpers.offset(req.query.page, req.query.perPage || 15),
      order: [
          ['createdAt', 'DESC']
        ]
    }).then(function(customers) {
      var result = helpers.setPagination(customers, req)
      next(null, result)
    }).catch(function(err){
      next(err)
    })
  }], function(err, result){
    res.render('admin/customers/index', { customers: result, query: req.query })
  })
})

admin.get("/customers/:id", function(req, res) {
  async.waterfall([function(next) {
    models.Customer.findById(req.params.id).then(function(customer) {
      if(customer){
        next(null, customer)
      }else{
        next(new Error(404))
      }
    }).catch(function(err) {
      next(err)
    })
  }], function(err, customer) {
    if(err){
      errHtmlRespone(err, res)
    }else{
      res.render("admin/customers/show", { customer: customer })
    }
  })

})

admin.post("/customer/:id", adminOnly, function(req, res) {
  async.waterfall([function(next) {
    models.Customer.findById(req.params.id).then(function(customer) {
      if(customer){
        next(null, customer)
      }else{
        next(new Error(404))
      }
    }).catch(function(err) {
      next(err)
    })
  }, function(customer, next) {

    customer.updateAttributes({
      total: req.body.total,
    }).then(function(customer) {
      next(null, customer)
    }).catch(function(err) {
      next(err)
    })
  }], function(err, customer) {
    if(err){
      console.log(err)
      res.redirect('/500')
    }else{
      req.flash('info', "update success")
      res.redirect('/admin/customers/' + customer.id)
    }
  })
})

admin.post("/customer/total/:id", adminOnly, function(req, res) {
  var type = req.body.type,
      amount = parseFloat(req.body.num)
  async.waterfall([function(next) {
    models.Customer.findById(req.params.id).then(function(customer) {
      if(customer){
        customer.takeFlowHistory(models, null, amount, req.body.comment, type=='1' ? models.FlowHistory.STATE.ADD : models.FlowHistory.STATE.REDUCE).then(function(flowhistory) {
          next(null, customer, flowhistory)
        }).catch(function(err) {
          console.log(err)
          next(err, customer)
        })
      }else{
        next(new Error(404))
      }
    })
  }, function(customer, flowhistory, next) {
    var value = customer.total
    if(type == '1' && amount > 0) {
      value = customer.total + amount
    }else if (customer.total >= amount && amount > 0){
      value = customer.total - amount
    }
    customer.updateAttributes({
      total: value
    }).then(function(customer) {
      next(null, customer)
    }).catch(function(err) {
      next(err)
    })
  }], function(err, customer, flowhistory) {
    if(err){
      console.log(err)
      req.flash('err', err.message)
      res.redirect('/admin/customers/' + customer.id)
    }else{
      req.flash('info', "update success")
      res.redirect('/admin/customers/' + customer.id)
    }
  })
})

module.exports = admin;