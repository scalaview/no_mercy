'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.addColumn(
      'Orders',
      'callbackDone',
      {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }
    );
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn( "Orders", "callbackDone")
  }
};
