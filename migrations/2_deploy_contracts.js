var VQPayments = artifacts.require("VQPayments");
var UserProxy = artifacts.require("UserProxy");

module.exports = function(deployer) {
  deployer.deploy(VQPayments);
  deployer.deploy(UserProxy);
};