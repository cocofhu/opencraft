const { configureProduct } = require("./product-entry.cjs");

module.exports = context => configureProduct(__dirname, context);
