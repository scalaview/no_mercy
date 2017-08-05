var express = require('express');
var admin = express.Router();
var models  = require('../../models')
var helpers = require("../../helpers")
var formidable = require('formidable')
var async = require("async")
var errHtmlRespone = helpers.errHtmlRespone
var adminOnly = helpers.adminOnly

admin.get('/products', function(req, res) {
  var customer = res.locals.customer
  async.waterfall([function(next) {
    var conditions = {}
    if(!customer.isAdmin()){
      conditions["display"] = true
    }
    models.Product.findAndCountAll({
      where: conditions,
      limit: req.query.perPage || 15,
      offset: helpers.offset(req.query.page, req.query.perPage || 15)
    }).then(function(products) {
      next(null, products)
    }).catch(function(err) {
      next(err)
    })
  }], function(err, products) {
    if(err){
      errHtmlRespone(err)
    }else{
      var providerOptions = { name: "providerId", class: 'select2 editChoose col-lg-12 col-xs-12' },
        providerCollection = models.Product.PROVIDERARRAY,

      result = helpers.setPagination(products, req)
      res.render('admin/products/index', {
        products: result,
        providerOptions: providerOptions,
        providerCollection: providerCollection
      })
    }
  })
})

admin.get('/products/new', adminOnly, function(req, res) {
  async.waterfall([function(next) {
    next(null)
  }], function(err) {
    if(err){
      errHtmlRespone(err, res)
    }else{
      var product = models.Product.build(),
          providerOptions = { name: "providerId", class: 'select2 col-lg-12 col-xs-12' },
          providerCollection = models.Product.PROVIDERARRAY,
          typeOptions = { name: "type", class: 'select2 col-lg-12 col-xs-12' },
          typeCollection = models.Product.TYPEARRAY

      res.render('admin/products/new', {
        product: product,
        providerOptions: providerOptions,
        providerCollection: providerCollection,
        typeOptions: typeOptions,
        typeCollection: typeCollection,
        path: '/admin/product'
      })
    }
  })
})


admin.post('/product', adminOnly, function(req, res) {
  var params = req.body
  if(params['display'] == 'on'){
    params['display'] = true
  }else{
    params['display'] = false
  }

  async.waterfall([function(next) {
    models.Product.build(params).save().then(function(product) {
      if(product){
        next(null, product)
      }else{
        next(new Error("save product invalidate"))
      }
    }).catch(function(err) {
      next(err)
    })
  }], function(err, product) {
    if(err){
      req.flash("err", "update fail")
      errHtmlRespone(err, res)
    }else{
      req.flash("info", "update success")
      res.redirect('/admin/products/' + product.id + '/edit')
    }
  })
})


admin.get('/products/:id/edit', adminOnly, function(req, res) {
  async.waterfall([function(next) {
    models.Product.findById(req.params.id).then(function(product) {
      next(null, product)
    }).catch(function(err) {
      next(err)
    })
  }], function(err, product, trafficgroupsCollection) {
    if(err){
      errHtmlRespone(err, res)
    }else{
      var providerOptions = { name: "providerId", class: 'select2 col-lg-12 col-xs-12' },
          providerCollection = models.Product.PROVIDERARRAY,
          typeOptions = { name: "type", class: 'select2 col-lg-12 col-xs-12' },
          typeCollection = models.Product.TYPEARRAY

      res.render('admin/products/new', {
          product: product,
          providerOptions: providerOptions,
          providerCollection: providerCollection,
          typeOptions: typeOptions,
          typeCollection: typeCollection,
          path: '/admin/product/' + product.id
        })
    }
  })
})

admin.get('/products/:id', function(req, res) {
  async.waterfall([function(next) {
    models.Product.findById(req.params.id).then(function(product) {
      next(null, product)
    }).catch(function(err) {
      next(err)
    })
  }], function(err, product) {
    if(err){
      console.log(err)
      res.json({ err: 1, message: err })
    }else{
      res.json({ err: 0, message: "", data: product })
    }
  })
})


admin.post('/product/:id', function(req, res){
  var params = req.body
  if(params['display'] == 'on'){
    params['display'] = true
  }else{
    params['display'] = false
  }
  async.waterfall([function(next) {
    models.Product.findById(req.params.id).then(function(product) {
      next(null, product)
    }).catch(function(err) {
      next(err)
    })
  }, function(product, next) {
    product.updateAttributes(params).then(function(product) {
      next(null, product)
    }).catch(function(err) {
      next(err)
    })
  }], function(err, product) {
    if(err){
      res.format({
        html: function(){
          req.flash("info", "update fail")
          errHtmlRespone(err, res)
        },
        json: function(){
          res.send({ message: 'update fail', err: 1 });
        }
      });
    }else{
      res.format({
        html: function(){
          req.flash("info", "update success")
          res.redirect('/admin/products/' + product.id + '/edit')
        },
        json: function(){
          res.send({ message: 'update success', err: 0 });
        }
      });
    }
  })
})

module.exports = admin;