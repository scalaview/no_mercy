'use strict';
module.exports = function(sequelize, DataTypes) {
  var Product = sequelize.define('Product', {
    name: { type: DataTypes.STRING, allowNull: false },
    providerId: { type: DataTypes.INTEGER, allowNull: false },
    province: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "全国"
    },
    value: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    type: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
    bid: { type: DataTypes.STRING, allowNull: true },
    price: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0.00 },
    purchasePrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0.0 },
    sortNum: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
    display: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  });

  Product.Provider = {
    '中国移动': 0,
    '中国联通': 1,
    '中国电信': 2
  }

  Product.ProviderName = {
    0: '中国移动',
    1: '中国联通',
    2: '中国电信'
  }

  Product.TYPE = {
    '曦和流量': 1
  }

  Product.PROVIDERARRAY = Object.keys(Product.Provider).map(function(k) { return [Product.Provider[k], k] });

  Product.TYPEARRAY = Object.keys(Product.TYPE).map(function(k) { return [Product.TYPE[k], k] });

  Product.associate = function(models){};

  Product.prototype.className = function(){
    return "Product";
  };

  Product.prototype.provider = function(){
    return Product.ProviderName[this.providerId];
  };

  Product.prototype.typeJson = function(){
    return Product.TYPE;
  };

  return Product;
};