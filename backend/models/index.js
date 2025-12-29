// Central export file for all models
const Medicine = require('./Medicine');
const Customer = require('./Customer');
const Supplier = require('./Supplier');
const Transaction = require('./Transaction');
const Purchase = require('./Purchase');

module.exports = {
  Medicine,
  Customer,
  Supplier,
  Transaction,
  Purchase
};