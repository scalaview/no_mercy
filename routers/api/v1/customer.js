var express = require('express');
var app = express.Router();
var models  = require(process.env.PWD + '/models')
var helpers = require(process.env.PWD + "/helpers")
var async = require("async")


app.post("/customer/create", function(req, res) {
  models.Customer.findOrCreate({
    where: {
      username: "test"
    },
    defaults: {
      username: "test",
      password: "123456"

    }
  }).spread(function(customer){
    res.json({
      msg: "success",
      customer: {
        client_id: customer.client_id,
        client_secret: customer.client_secret
      }
    })
  }).catch(function(err) {
    res.json(err)
  })
})

app.post("/auth/token", function(req, res) {
  var body = req.rawBody || req.body,
      client_id = body.client_id,
      client_secret = body.client_secret,
      grant_type = body.grant_type

  if(!(client_id && client_secret && grant_type == "client_credential")) {
    helpers.errRespone(new Error(50001), res)
    return
  }

  async.waterfall([function(next) {
    models.Customer.findOne({
      where: {
        client_id: client_id,
        client_secret: client_secret
      }
    }).then(function(customer) {
      if(customer){
        var now = (new Date()).getTime()
        if(customer.expires_in && customer.expires_in.getTime() > (now + 30000) && customer.access_token){
          next(null, customer)
        }else{
          customer.generateAccessToken().then(function(customer){
            next(null, customer)
          }).catch(function(err){
            next(err)
          })
        }
      }else{
        next(new Error(50002))
      }
    }).catch(function(err){
      next(err)
    })
  }], function(err, customer){
    if(err){
      helpers.errRespone(err, res)
    }else{
      res.json({
        errcode: 0,
        errmsg: "success",
        access_token: customer.access_token,
        expires_in: customer.expires_in.getTime()
      })
    }
  })
})


module.exports = app;