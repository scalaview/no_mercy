'use strict';
var async = require("async")

module.exports = function(sequelize, DataTypes) {
  var FlowHistory = sequelize.define('FlowHistory', {
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    state: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: true },
    typeId: { type: DataTypes.INTEGER, allowNull: true },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0.00 },
    comment: { type: DataTypes.STRING, allowNull: false },
    source: { type: DataTypes.VIRTUAL }
  }, {
    scopes: {
      income: {
        where: {
          state: 1
        },
        order: [
          ['createdAt', 'DESC']
        ]
      },
      reduce: {
        where: {
          state: 0
        },
        order: [
          ['createdAt', 'DESC']
        ]
      }
    }
  });
  FlowHistory.STATE = {
    ADD: 1,
    REDUCE: 0
  };


  FlowHistory.associate = function(models){
    models.FlowHistory.belongsTo(models.Customer, { foreignKey: 'customerId' });
    models.FlowHistory.belongsTo(models.Order, {
      foreignKey: 'typeId',
      scope: {
        type: 'Order'
      }
    });
  }

  FlowHistory.histories = function(options, state){
    return new Promise(function(rvo, rej){
      FlowHistory.scope(state).findAll(options || {}).then(function(flowHistories) {
          async.map(flowHistories, function(flowHistory, next){
            if( flowHistory.type === 'Order' ){
              flowHistory.getOrder().then(function(order) {
                flowHistory.source = order
                next(null, flowHistory)
              }).catch(function(err){
                next(err)
              })
            }else{
              flowHistory.getCustomer().then(function(customer) {
                flowHistory.source = customer
                next(null, flowHistory)
              }).catch(function(err){
                next(err)
              })
            }
          } , function(err, flowHistories){
            if(err){
              rej(err)
            }else{
              rvo(flowHistories)
            }
          })
        })
    });
  }

  FlowHistory.incomeHistories = function(options){
    return this.histories(options, 'income');
  }

  FlowHistory.reduceHistories = function(options){
    return this.histories(options, 'reduce');
  }

  FlowHistory.prototype.getSource = function(conditions){
    if(this.type){
      return this['get' + this.type].call(this, conditions);
    }
  }

  FlowHistory.prototype.stateName = function(){
    switch(this.state){
      case 1:
        return "增加"
      case 0:
        return "减少"
    }
  }

  return FlowHistory;
};