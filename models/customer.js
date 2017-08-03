'use strict';
var _ = require('lodash')
var async = require("async")
var config = require("../config")
var crypto = require('crypto');

module.exports = function(sequelize, DataTypes) {
  var concern = require('./concerns/profile_attributes')
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
      defaultValue: new Date(0)
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
      type: DataTypes.DECIMAL,
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
    }
  }, {
    classMethods: _.merge(concern.classMethods, {
      associate: function(models) {
        models.Customer.hasMany(models.Order, { foreignKey: 'customerId' })
      },
      validateToken: function(models, access_token){
        return models.Customer.findOne({
          where: {
            access_token: access_token,
            expires_in: {
              $gt: new Date()
            }
          }
        });
      }
    }),
    instanceMethods: _.merge(concern.instanceMethods, {
      className: function(){
        return 'Customer'
      },
      generateAccessToken: function(){
        var expires_in = (new Date()).getTime() + (config.expires_in || 3600000),
            access_token = crypto.createHmac('sha1', expires_in + "").update(this.password_hash).digest('hex');
        return this.updateAttributes({
          access_token: access_token,
          expires_in: expires_in
        })
      },
      isAdmin: function(){
        return this.role && this.role == "admin"
      },
      reduceTraffic: function(models, extractOrder, successCallBack, errCallBack) {
        var customer = this
        async.waterfall([function(next){
          extractOrder.getTrafficPlan().then(function(trafficPlan) {
            extractOrder.trafficPlan = trafficPlan
            next(null, extractOrder, trafficPlan)
          }).catch(function(err) {
            next(err)
          })
        }, function(extractOrder, trafficPlan, next){

          if(extractOrder.chargeType == models.Customer.CHARGETYPE.BALANCE){
            var enough = (extractOrder.state == models.ExtractOrder.STATE.PAID)
          }else{
            var enough = (customer.salary > extractOrder.total)
          }

          if(enough){
            if(extractOrder.chargeType == models.Customer.CHARGETYPE.BALANCE){
              next(null, customer, extractOrder, trafficPlan)
            }else{
              customer.updateAttributes({
                  salary: customer.salary - extractOrder.total
                }).then(function(customer){
                  next(null, customer, extractOrder, trafficPlan)
                }).catch(function(err) {
                  next(err)
                })
            }
          }else{
            next(new Error("剩余流量币不足"))
          }
        }, function(customer, extractOrder, trafficPlan, next){
          customer.takeFlowHistory(models, extractOrder, extractOrder.total, "购买流量" + trafficPlan.name + "至" + extractOrder.phone + " 支付成功", models.FlowHistory.STATE.REDUCE, function(flowHistory){
              next(null, customer, extractOrder, trafficPlan, flowHistory)
            }, function(err){
              next(err)
            }, (extractOrder.chargeType == models.Customer.CHARGETYPE.BALANCE) ? models.FlowHistory.TRAFFICTYPE.REMAININGTRAFFIC : models.FlowHistory.TRAFFICTYPE.SALARY)
        }], function(err, customer, extractOrder, trafficPlan, flowHistory){
          if(err){
            errCallBack(err)
          }else{
            successCallBack(customer, extractOrder, trafficPlan, flowHistory)
          }
        })
      },
      refundTraffic: function(models, extractOrder, message, successCallBack, errCallBack) {
        var customer = this
        async.waterfall([function(next) {

          if(extractOrder.chargeType == models.Customer.CHARGETYPE.BALANCE){
            next(null, customer, extractOrder)
          }else{
            customer.updateAttributes({
              salary: customer.salary + extractOrder.cost
            }).then(function(customer) {
              next(null, customer, extractOrder)
            }).catch(function(err) {
              next(err)
            })
          }
        }, function(customer, extractOrder, next) {
          extractOrder.getTrafficPlan().then(function(trafficPlan) {
            extractOrder.trafficPlan = trafficPlan
            next(null, customer, extractOrder, trafficPlan)
          }).catch(function(err) {
            next(err)
          })
        },function(customer, extractOrder, trafficPlan, next) {
          if(extractOrder.chargeType == models.Customer.CHARGETYPE.BALANCE){
            var msg = "提取" + trafficPlan.name + "至" + extractOrder.phone + "失败。原因：" + message + "。对你造成的不便我们万分抱歉"
          }else{
            var msg = "提取" + trafficPlan.name + "至" + extractOrder.phone + "失败。原因：" + message + "。分销奖励已经退还账户，对你造成的不便我们万分抱歉"
          }
          customer.takeFlowHistory(models, extractOrder, extractOrder.cost, msg, models.FlowHistory.STATE.ADD, function(flowHistory){
              next(null, customer, extractOrder, flowHistory)
            }, function(err) {
              next(err)
            }, (extractOrder.chargeType == models.Customer.CHARGETYPE.BALANCE) ? models.FlowHistory.TRAFFICTYPE.REMAININGTRAFFIC : models.FlowHistory.TRAFFICTYPE.SALARY)
        }], function(err, customer, extractOrder, flowHistory) {
          if(err){
            errCallBack(err)
          }else{
            successCallBack(customer, extractOrder, flowHistory)
          }
        })
      },
      takeFlowHistory: function(models, obj, amount, comment, state, successCallBack, errCallBack, from){
        var customer = this
        if(state !== models.FlowHistory.STATE.ADD && state !== models.FlowHistory.STATE.REDUCE){
          return errCallBack(new Error("Type Error"))
        }
        var params = {
          customerId: customer.id,
          state: state,
          amount: amount,
          comment: comment
        }
        if(obj !== undefined){
          _.merge(params, {
            type: obj.className(),
            typeId: obj.id
          })
        }
        if(from != undefined) {
          _.merge(params, {
            trafficType: from,
            ownerId: obj.id
          })
        }
        models.FlowHistory.build(params).save().then(function(flowHistory){
          successCallBack(flowHistory)
        }).catch(function(err){
          errCallBack(err)
        })
      },
      getLastFlowHistory: function(models, state, successCallBack, errCallBack){
        var customer = this
        if(state === undefined){
          this.getFlowHistories().then(function(flowHistories){
            if(flowHistories.length > 0){
              successCallBack(flowHistories[flowHistories.length - 1])
            }else{
              successCallBack()
            }
          }).catch(errCallBack)
        }else if( (state === models.FlowHistory.STATE.ADD) || (state === models.FlowHistory.STATE.REDUCE) ){
          async.waterfall([function(next){
            models.FlowHistory.findOne({ where: {
                customerId: customer.id,
                state: state
              }, order: [
                ['createdAt', 'DESC']
              ]
            }).then(function(flowHistory){
              if(flowHistory){
                customer.lastFlowHistory = flowHistory
                next(null, customer)
              }else{
                successCallBack(customer)
              }
            }).catch(errCallBack)
          }, function(customer, next){
            var flowHistory = customer.lastFlowHistory
            if(flowHistory.type){
              models[flowHistory.type].findById(flowHistory.typeId).then(function(source){
                if(source){
                  flowHistory.source = source
                }
                successCallBack(customer, flowHistory)
              }).catch(errCallBack)
            }else{
              successCallBack(customer, flowHistory)
            }
          }], function(err, result){
          })

        }else{
          errCallBack(new Error("FlowHistory state not include"))
        }
      }
    }),
    scopes: {

    }
  });

  Customer.CHARGETYPE = {
    BALANCE: "balance",
    SALARY: "salary"
  }

  return Customer;
};