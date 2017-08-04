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
        res.locals.customer = customer
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

admin.get('/login', function(req, res){
  if(req.query.to){
    backTo = new Buffer(req.query.to, "base64").toString()
  }
  res.render('admin/login', { layout: 'sign', backTo: req.query.to })
})

admin.post('/login', function(req, res) {
  models.Customer.findOne({ where: {username: req.body.username} }).then(function(customer){
    if(customer && customer.verifyPassword(req.body.password)){
      req.session.customer_id = customer.id
      if(req.body.to){
        var backTo = new Buffer(req.body.to, "base64").toString()
        res.redirect(backTo)
      }else{
        res.redirect('/admin')
      }
    }else{
      var message
      if(customer){
        message = 'password error'
      }else{
        message = 'register new user'
      }
      res.render('admin/login', {
       locals: {message: message},
       layout: 'sign'
      })
    }
  })
})

admin.get('/logout', function(req, res) {
  req.session.customer_id = null
  res.redirect('/admin/login')
})


admin.get('/register', function(req, res){
  res.render('admin/register', { layout: 'sign' })
})

admin.post('/register', function(req, res, next){
  var customer = models.Customer.build({
    username: req.body.username,
    password: req.body.password
  })

  customer.save().then(function(customer) {
    req.session.customer_id = customer.id
    req.flash("info", "注册成功")
    res.redirect('/admin')
  }).catch(function(err) {
    req.flash('err', err.message)
    res.render('admin/register', {
      customer: customer,
      layout: 'sign'
    })
  })
});

admin.get('/', function (req, res) {
  res.render('admin/home');
});

module.exports = admin;