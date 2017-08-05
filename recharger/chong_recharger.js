'use strict';
var request = require("request")
var async = require("async")
var helpers = require("../helpers")
var config = require("../config")
var crypto = require('crypto')
var Promise = require("bluebird");

function storeCallback(models){
  return new Promise(function(rvo, rej){
    models.DConfig.findOrCreate({
      where: {
        name: "chongAccessToken"
      },
      defaults: {
        value: "{}"
      }
    }).spread(function(accessToken) {
      if(accessToken.value.present()){
        rvo(JSON.parse(accessToken.value));
      }else{
        rvo({accessToken: "", expireTime: 0})
      }
    }).catch(function(err) {
      rej(err)
    })
  })
}

function accessCallback(models, token){
  models.DConfig.findOrCreate({
    where: {
      name: "chongAccessToken"
    },
    defaults: {
      value: "{}"
    }
  }).spread(function(accessToken) {
      accessToken.updateAttributes({
        value: JSON.stringify(token)
      }).then(function(accessToken) {
        return null;
      }).catch(function(err){
        return null;
      })
  }).catch(function(err) {
     return null;
  })
}



var ChongRecharger = function(client_id, client_secret, debug){
  if(debug){
    this.client_id = "flow3355e802d44ay95yeev2";
    this.client_secret = "eal0ycl5argvq8v3cthm5qnzq1ljqf1429506832";
  }else{
    this.client_id = client_id;
    this.client_secret = client_secret;
  }
  this.storeCallback = storeCallback;
  this.accessCallback = accessCallback;
}


ChongRecharger.prototype.requireToken = function(models){
    var that = this
    var params = {
      client_id: this.client_id,
      client_secret: this.client_secret,
      grant_type: "client_credential"
    }
    var host = "http://api.xunion.me/v1/auth/token"
    var options = {
      uri: host,
      method: 'POST',
      qs: params
    }
    return new Promise(function(rvo, rej){
      request(options, function (error, res) {
        if (!error && res.statusCode == 200) {
          console.log(res.body)
          var data = JSON.parse(res.body)
          if(data.access_token){
            var now = (new Date()).getTime() + data.expires_in * 1000
            that.accessCallback(models, {accessToken: data.access_token, expireTime: now})
            rvo({accessToken: data.access_token, expireTime: now})
          }else{
            rvo({accessToken: "", expireTime: 0})
          }
        }else{
          rej(error)
        }
     });
    })
}

ChongRecharger.prototype.getAccessToken = function(models){
  var that = this
  return new Promise(function(rvo, rej){
    that.storeCallback(models).then(function(token){
      var now = (new Date()).getTime();
      if(now < token.expireTime){
        rvo(token)
      }else{
        that.requireToken(models).then(function(token){
          rvo(token)
        }).catch(function(err){
          rej(err)
        })
      }
    }).catch(function(err){
      rej(err)
    })
  })
}


ChongRecharger.prototype._getProducts = function(access_token){
  var host = "http://api.xunion.me/v1/product/lists"

  var options = {
        uri: host,
        method: "GET",
        qs: {
          access_token: access_token
        }
      }
  return new Promise(function(rvo, rej){
    request(options, function (error, res) {
      if (!error && res.statusCode == 200) {
        console.log(res.body)
        var data = JSON.parse(res.body)
        rvo(data)
      }else{
        rej(error)
      }
    });
  })
}



ChongRecharger.prototype.getProducts = function(models){
  var that = this

  return new Promise(function(rvo, rej){
    that.getAccessToken(models).then(function(token){
      that._getProducts(token.accessToken).then(function(data){
        rvo(data)
      }).catch(function(err){
        rej(err)
      })
    }).catch(function(err){
      rej(err)
    })
  });
}

ChongRecharger.prototype._rechargeOrder = function(access_token, phone, productId, callbackUrl){
    var host = "http://api.xunion.me/v1/flow/recharge/order"

    var signParams = {
      callback_url: callbackUrl,
      client_id: this.client_id,
      number: phone,
      product_id: productId
    }
    var sign = helpers.sign(signParams)

    signParams['sign'] = sign
    signParams['access_token'] = access_token

    var options = {
          uri: host,
          method: "POST",
          qs: signParams
        }

    return new Promise(function(rvo, rej){
      request(options, function (error, res) {
        if (!error && res.statusCode == 200) {
          if(successCallback){
            console.log(res.body)
            var data = JSON.parse(res.body)
            rvo(data)
          }
        }else{
          rej(error)
        }
      });
    });
}

ChongRecharger.prototype._rechargeOrder = function(models, phone, productId, callbackUrl){
  var that = this

  return new Promise(function(rvo, rej){
    that.getAccessToken(models).then(function(token){
      that._rechargeOrder(token.accessToken).then(function(data){
        rvo(data)
      }).catch(function(err){
        rej(err)
      })
    }).catch(function(err){
      rej(err)
    })
  })
}


exports.ChongRecharger = ChongRecharger;