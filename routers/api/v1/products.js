var express = require('express');
var app = express.Router();
var models  = require(process.env.PWD + '/models')
var helpers = require(process.env.PWD + "/helpers")
var async = require("async")
var validateToken = helpers.validateToken
var errRespone = helpers.errRespone

app.get("/product/lists", validateToken, function(req, res) {
  var access_token = req.query.access_token,
      customer = res.locals.customer

  if(!access_token) {
    errRespone(new Error(50012), res)
    return
  }

  async.waterfall([function(next) {
    models.Product.findAll({
      where: {
        display: true
      },
      order: [
        'providerId', 'province', 'sortNum'
      ]
    }).then(function(products) {
      next(null, customer, products)
    }).catch(function(err){
      next(err)
    })
  }, function(customer, products, pass) {
    async.map(products, function(product, next) {
      next(null, {
        product_id: product.id,
        name: product.name,
        price: product.price,
        flow_value: product.value,
        provider_id: product.providerId,
        province: product.province
      })
    }, function(err, productsJson){
      pass(null, customer, productsJson)
    })
  }], function(err, customer, productsJson){
    if(err){
      helpers.errRespone(err, res)
    }else{
      res.json({
        errcode: 0,
        errmsg: "success",
        products: productsJson
      })
    }
  })

})


module.exports = app;