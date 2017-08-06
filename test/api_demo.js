request = require("request")
models = require("../models")
async = require("async");
Ch = require("../recharger").ChongRecharger
var helpers = require(process.env.PWD + "/helpers")

function errfunc(e){
  console.log(e)
}


function auth(){
  var options = {
      uri: "http://localhost:3008/api/v1/auth/token",
      method: 'POST',
      json: {
        client_id: "ff39f26ae46c60ff7c82d2701954ddecc13660be",
        client_secret: "1732047e2940783ed849aced6d1bcf1bd7227bcc",
        grant_type: "client_credential"
      }
    }
  return new Promise(function(rvo, rej){
    request(options, function (error, res) {
      if (!error && res.statusCode == 200) {
        console.log(res.body)
        var data = res.body
        if(data.errcode === 0){
          var now = (new Date()).getTime() + data.expires_in * 1000
          rvo({accessToken: data.access_token, expireTime: now})
        }else{
          rvo({accessToken: "", expireTime: 0})
        }
      }else{
        rej(error)
      }
    });
  });
}


function getProducts(access_token){
  return new Promise(function(rvo, rej){
    request.get({url: "http://localhost:3008/api/v1/product/lists?access_token=" + access_token }, function (error, res) {
      if (!error && res.statusCode == 200) {
        var data = res.body
        rvo(data)
      }else{
        rej(error)
      }
    });
  });
}


function order(accessToken){
  var options = {
    uri: "http://localhost:3008/api/v1/flow/recharge/order",
    method: 'POST'
  }
  var signParams = {
    client_id: "ff39f26ae46c60ff7c82d2701954ddecc13660be",
    phone: "13823212465",
    product_id: "3",
    callback_url: "http://localhost:3008/callback_url",
    user_order_id: (Math.random() * 1000).toFixed(0)
  }
  signParams['sign'] = helpers.sign(signParams)
  signParams['access_token'] = accessToken
  options["json"] = signParams
  return new Promise(function(rvo, rej){
    request(options, function (error, res) {
      if (!error && res.statusCode == 200) {
        console.log(res.body)
        var data = res.body
        rvo(data)
      }else{
        rej(error)
      }
    });
  });
}

function phone_data(accessToken, phone){
  return new Promise(function(rvo, rej){
    request.get({url: "http://localhost:3008/api/v1/phone/data?phone="+phone+"&access_token="+accessToken}, function (error, res) {
      if (!error && res.statusCode == 200) {
        console.log(res.body)
        var data = res.body
        rvo(data)
      }else{
        rej(error)
      }
    });
  })
}

function main(){
  async.waterfall([function(next){
    auth().then(function(data){
      next(null, data.accessToken)
    }).catch(function(err){
      next(err)
    })
  }, function(accessToken, next){
    phone_data(accessToken, "13823212465").then(function(data){
      console.log(JSON.parse(data))
      next(null, accessToken)
    }).catch(function(err){
      next(err)
    })
  }, function(accessToken, next){
    getProducts(accessToken).then(function(data){
      console.log(data)
      next(null, accessToken)
    }).catch(function(err){
      next(err)
    })
  }, function(accessToken, next){
    order(accessToken).then(function(data){

    }).catch(function(err){
      next(err)
    })
  }], function(err){
    if(err) console.log(err)
    console.log("finish")
  })
}


main()

