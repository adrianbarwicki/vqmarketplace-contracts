var VQPayments = artifacts.require("VQPayments");

module.exports = function(deployer) {
  deployer.deploy(VQPayments);
};