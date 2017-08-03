'use strict';
module.exports = {
  up: function(queryInterface, Sequelize) {
    return queryInterface.createTable('Products', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING, allowNull: false
      },
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
      sortNum: {
        type: Sequelize.INTEGER, allowNull: true, defaultValue: 0
      },
      display: {
        type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true
      },
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
    return queryInterface.dropTable('Products');
  }
};