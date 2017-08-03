'use strict';
module.exports = {
  up: function(queryInterface, Sequelize) {
    return queryInterface.createTable('Orders', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      state: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      phone: {  type: Sequelize.STRING, allowNull: true },
      providerId: {
        type: Sequelize.INTEGER, allowNull: false
      },
      province: {
        type: Sequelize.STRING,
        allowNull: false
      },
      value: {
       type: Sequelize.INTEGER, allowNull: false, defaultValue: 0
      },
      type: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
      bid: { type: Sequelize.STRING, allowNull: true },
      price: {
        type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0.00
      },
      purchasePrice: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0.0 },
      customerId: { type: Sequelize.INTEGER, allowNull: true },
      transactionId: { type: Sequelize.STRING },
      total: { type: Sequelize.DECIMAL(10, 2), allowNull: true, defaultValue: 0.0 },
      taskid: { type: Sequelize.STRING, allowNull: true },
      callbackUrl: { type: Sequelize.STRING, allowNull: true },
      userOrderId: { type: Sequelize.STRING, allowNull: true},
      productId: { type: Sequelize.INTEGER, allowNull: true},
      message: { type: Sequelize.STRING, allowNull: true},
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: function(queryInterface, Sequelize) {
    return queryInterface.dropTable('Orders');
  }
};