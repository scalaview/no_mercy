var express = require('express');
var admin = express.Router();
var models  = require('../../models')
var helpers = require("../../helpers")
var async = require("async")
var _ = require('lodash')
var config = require("../../config")
var errHtmlRespone = helpers.errHtmlRespone
var adminOnly = helpers.adminOnly

// login filter
var skipUrls = [ '^\/admin\/login[\/|\?|\#]\?.*', '^\/admin\/register[\/|\?|\#]\?.*']

admin.all("*", function(req, res, next) {
  var url = req.originalUrl
  if(req.session.customer_id){
    models.Customer.findOne({ where: { id: req.session.customer_id } }).then(function(customer) {
      if(customer){
        req.customer = customer
        next();
      }else{
        res.redirect("/admin/login?to=" + encodeUrl);
      }
    }).catch(function(err){
      errHtmlRespone(err, res)
    })
  }else{
    for (var i = skipUrls.length - 1; i >= 0; i--) {
      var match = req.originalUrl.match(skipUrls[i]);
      if(match !== null){
        next()
        return
      }
    };
    var encodeUrl = new Buffer(url).toString('base64');
    return res.redirect("/admin/login?to=" + encodeUrl);
  }
})


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

admin.post("/customer/:id", function(req, res) {
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

admin.post("/customer/traffic/:id", function(req, res) {
  var type = req.body.type,
      amount = parseInt(req.body.num)
  async.waterfall([function(next) {
    models.Customer.findById(req.params.id).then(function(customer) {
      if(customer){
        models.FlowHistory.build({
          customerId: customer.id,
          state: type,
          amount: amount,
          comment: req.body.comment
        }).save().then(function(flowhistory) {
          next(null, customer, flowhistory)
        }).catch(function(err) {
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