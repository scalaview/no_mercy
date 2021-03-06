'use strict';
var helpers = require("../helpers")
var config = require("../config")
var ChongRecharger = require("../recharger").ChongRecharger

module.exports = function(sequelize, DataTypes) {
  var Order = sequelize.define('Order', {
    state: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    phone: {  type: DataTypes.STRING, allowNull: true },
    providerId: {
      type: DataTypes.INTEGER, allowNull: false
    },
    province: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "全国"
    },
    value: {
      type: DataTypes.INTEGER, allowNull: false, defaultValue: 0
    },
    type: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
    bid: { type: DataTypes.STRING, allowNull: true },
    price: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0.00 },
    purchasePrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0.0 },
    customerId: { type: DataTypes.INTEGER, allowNull: true },
    transactionId: {
      type: DataTypes.STRING,
      set: function(transactionId){
        if(!transactionId){
          var transactionId = helpers.strftime(new Date(), "YYYYMMDDHHmmss") + this.customerId + (helpers.randomInt() + "")
        }
        this.setDataValue('transactionId', transactionId);
      }
    },
    total: { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: 0.0 },
    taskid: { type: DataTypes.STRING, allowNull: true },
    callbackUrl: { type: DataTypes.STRING, allowNull: true },
    userOrderId: { type: DataTypes.STRING, allowNull: true},
    productId: { type: DataTypes.INTEGER, allowNull: true},
    message: { type: DataTypes.STRING, allowNull: true },
    callbackDone: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    product: {
      type: DataTypes.VIRTUAL
    }
  });

  Order.STATE = {
    INIT: 0,
    PAID: 1,
    UNPAID: 2,
    SUCCESS: 3,
    FAIL: 4,
    REFUNDED: 5,
    FINISH: 6
  }

  Order.associate = function(models){
    models.Order.belongsTo(models.Customer, { foreignKey: 'customerId' });
    models.Order.belongsTo(models.Product, { foreignKey: 'productId' });
  };

  Order.prototype.isDone = function(){
    return (this.state === Order.STATE.SUCCESS);
  };

  Order.prototype.className = function(){
    return "Order";
  };

  Order.prototype.stateName = function(){
    if(this.state === Order.STATE.INIT){
      return "待付款"
    }else if(this.state === Order.STATE.SUCCESS){
      return "充值任务提交成功"
    }else if(this.state === Order.STATE.FAIL){
      return "失败"
    }else if(this.state === Order.STATE.PAID){
      return "付款成功"
    }else if(this.state === Order.STATE.UNPAID){
      return "付款失败"
    }else if(this.state === Order.STATE.REFUNDED){
      return "退款"
    }else if(this.state === Order.STATE.FINISH){
      return "充值成功"
    }
  };

  Order.prototype.autoRecharge = function(models, product){
  console.log("autoRecharge")
    var typeJson = product.typeJson()
    if(product.type == typeJson['曦和流量']){
      return new ChongRecharger(config.xh_client_id, config.xh_client_secret, false).rechargeOrder(models, this.phone, this.bid, config.xh_callback_url)
    }else{
      return new Promise(function(rvo, rej){
      })
    }
  };

  Order.prototype.isPaid = function(){
    return (this.state === Order.STATE.PAID);
  }

  return Order;
};