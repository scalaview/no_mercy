models = require("../models")
async = require("async");
Ch = require("../recharger").ChongRecharger

var config = require("../config")

function getProvider(provider_type){
  switch(provider_type){
  case '1':
    return 2;
  case '2':
    return 0;
  case '3':
    return 1
  }
}

function getProvince(name){
  var yd = name.indexOf("移动");
  if(yd != -1){
    return name.slice(0, yd);
  }

  var dx = name.indexOf("电信");
  if(dx != -1){
    return name.slice(0, dx);
  }

  var lt = name.indexOf("联通");
  if(lt != -1){
    return name.slice(0, lt);
  }
  return "未知";
}

c = new Ch(config.xh_client_id, config.xh_client_secret, true)
c.getProducts(models).then(function(data){
  async.each(data.products, function(plan, next){
    models.Product.findOrCreate({
      where: {
        value: plan.flow_value,
        type: models.Product.TYPE["曦和流量"],
        bid: plan.product_id
      },
      defaults: {
        name: plan.name,
        providerId: getProvider(plan.provider_type),
        province: getProvince(plan.name),
        value: plan.flow_value,
        type: models.Product.TYPE["曦和流量"],
        bid: plan.product_id,
        price: plan.price,
        purchasePrice: plan.cost,
        display: false
      }
    }).spread(function(product){
      product.updateAttributes({
        name: plan.name,
        price: plan.price,
        purchasePrice: plan.cost,
        providerId: getProvider(plan.provider_type)
      }).then(function(product){
        next(null)
      })
    }).catch(function(err){
      next(err)
    })
  }, function(err){
    console.log(err)
  })
})
