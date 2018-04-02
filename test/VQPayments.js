const VQPayments = artifacts.require('../contracts/VQPayments.sol');

contract('VQPayments', function(accounts) {
  
  let contract;

  beforeEach('setup contract for each test', async function () {
    return VQPayments.deployed().then(function(instance) {
      contract = instance;
    });
  });

/*   it("has the right interface", async function() {
      // assert.isDefined(contract.invest);
      assert.isDefined(contract.withdraw);
  }); */

/*   onlyOwner
  onlyPayer
  onlyPayee
  onlyManager
  onlyWhen
  onlyFreeUser
  onlyFreeTransaction
  hasDeposit

  addManager
  setManagerFee
  getManagerFee
  createTransaction
  acceptTransaction
  cancelTransaction
  getUserTransactionsCount
  getUserTransactionByID
  payerAudit
  payeeAudit
  transactionAudit
  checkTransactionStatus
  releaseDeposit
  refundDeposit
  lockUserAccess
  lockTransaction
  createDispute
  concludeDispute
  withdrawDeposits
  checkBalance */

  it("has the right owner", async function() {
    assert.equal(await contract.owner(), accounts[0]);
    // Test Accounts:
    // 0 OWNER
    // 1 PAYER
    // 2 PAYEE
    // 3 MANAGER
  });

  it("creates a transaction", async function() {
    await contract.createTransaction(
      accounts[2], //payee
      accounts[3], //manager
      //web3.fromAscii("test"), //ref
    {
      value: web3.toWei(1, "ether"), //1000000000000000000 wei
      from: accounts[1] //payer
    });

    await contract.Deposits(accounts[0]).then(function(od) {
      assert.equal(od, web3.toWei(1, "ether") / 400);
    });

    await contract.payerAudit(accounts[1], 0, 1).then(function(pr){
       let payerRegistry = {
        payee: pr[0][0],
        manager: pr[1][0],
        amount: pr[2][0],
        status: pr[3][0],
      };

      assert.equal(payerRegistry.payee, accounts[2]);
      assert.equal(payerRegistry.manager, accounts[3]);
      assert.equal(
        payerRegistry.amount.toNumber(),
        web3.toWei(1, "ether") -
        (web3.toWei(1, "ether") / 400)
      );
      assert.equal(payerRegistry.status.toString().replace(/0+$/g, ""), web3.toHex("In Progress"));
      //assert.equal(web3.toAscii(payerRegistry.ref), "test");
    });

    await contract.payeeAudit(accounts[2], 0, 5).then(function(pr) {
      let payeeRegistry = {
        payer: pr[0][0],
        manager: pr[1][0],
        amount: pr[2][0],
        status: pr[3][0],
      };

      assert.equal(payeeRegistry.payer, accounts[1]);
      assert.equal(payeeRegistry.manager, accounts[3]);
      assert.equal(
        payeeRegistry.amount.toNumber(),
        web3.toWei(1, "ether") -
        (web3.toWei(1, "ether") / 400)
      );
      assert.equal(payeeRegistry.status.toString().replace(/0+$/g, ""), web3.toHex("In Progress"));
    });

    await contract.transactionAudit(accounts[1], 0, 1).then(function(ta){
      let transactionRegistry = {
        payer: ta[0][0],
        payee: ta[1][0],
        amount: ta[2][0],
        status: ta[3][0],
      };
      assert.equal(transactionRegistry.payer, accounts[1]);
      assert.equal(transactionRegistry.payee, accounts[2]);
      assert.equal(
        transactionRegistry.amount.toNumber(),
        web3.toWei(1, "ether") -
        (web3.toWei(1, "ether") / 400)
      );
      assert.equal(transactionRegistry.status.toString().replace(/0+$/g, ""), web3.toHex("In Progress"));
    });
  });


/*   it("can withdraw fees", async function() {
    await contract.sendTransaction({ value: web3.toWei(1, "ether"), from: accounts[1] })
    await contract.sendTransaction({ value: web3.toWei(1, "ether"), from: accounts[2] })

    let balances0 = await contract.balances(accounts[0])
    
    assert.equal(balances0.toNumber(), web3.toWei(1.1, "ether"))

    let startBalance = web3.fromWei(web3.eth.getBalance(web3.eth.accounts[0]), "ether");

    await contract.withdraw();

    let endBalance = web3.fromWei(web3.eth.getBalance(web3.eth.accounts[0]), "ether");

    balances0 = await contract.balances(accounts[0])
    assert.equal(balances0.toNumber(), web3.toWei(0, "ether"))

    assert.isTrue(startBalance.toNumber() < endBalance.toNumber())
  }); */
});