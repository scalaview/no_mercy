'use strict';
var _ = require('lodash');
var async = require("async");
var config = require("../config");
var crypto = require('crypto');
var Promise = require("bluebird");

module.exports = function(sequelize, DataTypes) {
  var Customer = sequelize.define('Customer', {
    username: {type: DataTypes.STRING, allowNull: false},
    phone: { type: DataTypes.STRING, allowNull: true },
    password_hash: {type: DataTypes.STRING, allowNull: false},
    password: {
      type: DataTypes.VIRTUAL,
      set: function(val){
        this.setDataValue('password', val);
        this.setDataValue('salt', this.makeSalt())
        this.setDataValue('password_hash', this.encryptPassword(this.password));
        this.setDataValue('client_id', this.encryptPassword(config.hostname + this.makeSalt()));
        this.setDataValue('client_secret', this.encryptPassword(this.client_id + this.makeSalt()));
      },
      validate: {
         isLongEnough: function (val) {
           if (val.length < 6) {
             throw new Error("Please choose a longer password")
          }
       }
      }
    },
    salt: { type: DataTypes.STRING, allowNull: false },
    client_id: {
      allowNull: false,
      type: DataTypes.STRING
    },
    client_secret: {
      allowNull: false,
      type: DataTypes.STRING
    },
    access_token: {
      allowNull: true,
      type: DataTypes.STRING
    },
    expires_in: {
      allowNull: true,
      type: DataTypes.DATE,
      defaultValue: new Date()
    },
    total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      set: function(val) {
        this.setDataValue('total', parseFloat(val))
      }
    },
    orderTotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      set: function(val) {
        this.setDataValue('orderTotal', parseFloat(val))
      }
    },
    role: {
        type: DataTypes.STRING,
        allowNull: true
    },
    enable: {
      type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true
    },
    is_admin: {
      type: DataTypes.VIRTUAL,
      get: function(){
        return this.isAdmin();
      }
    }
  });

  //==== classMethods =====
  Customer.authorization = function(username, password, callback) {
    this.find({ where: {username: username} }).on('success', function(user) {
      if(user.verifyPassword(password)){
        callback(user)
      }
    }).on('error', function(error) {
      callback(error)
    })
  }

  Customer.encryptPassword = function(password, salt) {
    return crypto.createHmac('sha1', salt).update(password).digest('hex');
  }

  Customer.associate = function(models) {
    models.Customer.hasMany(models.Order, { foreignKey: 'customerId' })
  }

  Customer.validateToken = function(models, access_token){
    return models.Customer.findOne({
      where: {
        access_token: access_token,
        expires_in: {
          $gt: new Date()
        }
      }
    });
  }

  //==== classMethods =====

  //==== instanceMethods ===
  Customer.prototype.resetPassword = function(password) {
    this.password = password
    return this.save()
  }

  Customer.prototype.verifyPassword = function(password) {
    return this.encryptPassword(password) == this.password_hash
  }

  Customer.prototype.makeSalt = function(){
    return Math.round((new Date().valueOf() * Math.random())) + '';
  }

  Customer.prototype.encryptPassword = function(password) {
    return crypto.createHmac('sha1', this.salt).update(password).digest('hex');
  }

  Customer.prototype.className = function(){
    return 'Customer'
  }

  Customer.prototype.generateAccessToken = function(){
    var expires_in = (new Date()).getTime() + (config.expires_in || 3600000),
        access_token = crypto.createHmac('sha1', expires_in + "").update(this.password_hash).digest('hex');
    return this.updateAttributes({
      access_token: access_token,
      expires_in: expires_in
    })
  }

  Customer.prototype.isAdmin = function(){
    return this.role && this.role == "admin"
  }

  Customer.prototype.takeFlowHistory = function(models, target, amount, comment, state){
    var customer = this
    return new Promise(function(rov, rej){
      if(state !== models.FlowHistory.STATE.ADD && state !== models.FlowHistory.STATE.REDUCE){
        rej(new Error("Type Error"))
      }
      var params = {
        customerId: customer.id,
        state: state,
        amount: amount,
        comment: comment
      }
      if(target){
        params['type'] = target.className()
        params['typeId'] = target.id
      }
      models.FlowHistory.build(params).save().then(function(flowHistory){
        rov(flowHistory)
      }).catch(function(err){
        rej(err)
      })
    })
  }

  Customer.prototype.reduceTotal = function(models, order) {
    var customer = this
    return new Promise(function(rvo, rej){
      async.waterfall([function(next){
        if(order.total > 0 && customer.total >= order.total){
          customer.updateAttributes({
              total: customer.total - order.total
          }).then(function(customer){
            next(null, customer, order)
          }).catch(function(err) {
            next(err)
          })
        }else{
          rej(new Error("剩余流量币不足"))
        }
      }, function(customer, order, next){
        order.getProduct().then(function(product){
          next(null, customer, order, product);
        }).catch(function(err){
          next(err)
        })
      }, function(customer, order, product, next){
        customer.takeFlowHistory(models, order, order.total, "购买流量" + product.name + "至" + order.phone + " 支付成功", models.FlowHistory.STATE.REDUCE).then(function(flowHistory){
          next(null, customer, order, flowHistory)
        }).catch(function(err){
          next(err)
        })
      }], function(err, customer, order, flowHistory){
        if(err){
          rej(err)
        }else{
          rvo(flowHistory)
        }
      })
    })
  }

  Customer.prototype.refundTotal = function(models, order, message) {
    var customer = this
    return new Promise(function(rvo, rej){
      async.waterfall([function(next) {
        if(order.total >= 0){
          customer.updateAttributes({
            total: customer.total + order.total
          }).then(function(customer) {
            next(null, customer, order)
          }).catch(function(err) {
            next(err)
          })
        }else{
          rej(new Error("订单金额错误"))
        }
      }, function(customer, order, next){
        order.getProduct().then(function(product){
          next(null, customer, order, product);
        }).catch(function(err){
          next(err)
        })
      }, function(customer, order, product, next){
        var msg = "提取" + product.name + "至" + order.phone + "失败。原因：" + order.message
        customer.takeFlowHistory(models, order, order.total, msg, models.FlowHistory.STATE.ADD).then(function(flowHistory){
          next(null, customer, order, flowHistory)
        }).catch(function(err){
          next(err)
        })
      }], function(err, customer, order, flowHistory){
        if(err){
          rej(err)
        }else{
          rvo(flowHistory)
        }
      })
    })
  }

  //==== instanceMethods ===

  Customer.CHARGETYPE = {
    BALANCE: "balance",
    SALARY: "salary"
  }

  return Customer;
};