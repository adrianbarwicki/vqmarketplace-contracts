require('babel-register')
require('babel-polyfill')

const expectThrow = require('./expectThrow.js');
const expectCorrectUser = require('./expectCorrectUser.js');

const VQPayments = artifacts.require('../contracts/VQPayments.sol');

contract('VQPayments', async (accounts) => {
  

  let TRANSACTION_STATE = {
    is_accepted: "is_accepted",
    has_dispute: "has_dispute",
    paid: "paid",
    refunded: "refunded",
    is_locked: "is_locked",
    is_cancelled: "is_cancelled"
  };

  let TEST_ACCOUNTS = {
    owner: accounts[0],
    payer: accounts[1],
    payee: accounts[2],
    manager: accounts[3]
  };

  beforeEach('setup contract for each test', async () => {
    return VQPayments.deployed().then((instance) => {
      contract = instance;
    });
  });

  it("has the right owner", async () => {
    assert.equal(await contract.owner(), TEST_ACCOUNTS.owner);
  });

/*   it("has the right interface", async () => {
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
  getTransactionStatus
  releaseDeposit
  refundDeposit
  lockUserAccess
  lockTransaction
  createDispute
  concludeDispute
  withdrawDeposits
  checkBalance */

  describe("Function: createTransaction", () => {
    it("created the transaction", async () => {
      contract.createTransaction(
        TEST_ACCOUNTS.payee, //payee
        TEST_ACCOUNTS.manager, //manager
        web3.toHex("test"), //ref
      {
        value: web3.toWei(1, "ether"), //1000000000000000000 wei
        from: TEST_ACCOUNTS.payer //payer
      }).then(result => {
        assert.equal(result.receipt.status, 1);
      });
    });

     it("deposited correct amount of money to owner account", async () => {
      contract.Deposits(TEST_ACCOUNTS.owner).then((od) => {
        assert.equal(od, web3.toWei(1, "ether") / 400);
      });
    });

    it("added transaction to PayerRegistry", async () => {
      contract.payerAudit(TEST_ACCOUNTS.payer, 0, 1).then((pr) => {
        let payerRegistry = {
         payee: pr[0][0],
         manager: pr[1][0]
       };
 
       assert.equal(payerRegistry.payee, TEST_ACCOUNTS.payee);
       assert.equal(payerRegistry.manager, TEST_ACCOUNTS.manager);
      });
    });

    it("added transaction to PayeeRegistry", async () => {
      contract.payeeAudit(TEST_ACCOUNTS.payee, 0, 5).then((pr) => {
        let payeeRegistry = {
          payer: pr[0][0],
          manager: pr[1][0]
        };
  
        assert.equal(payeeRegistry.payer, TEST_ACCOUNTS.payer);
        assert.equal(payeeRegistry.manager, TEST_ACCOUNTS.manager);
      });
    });

    it("added transaction to TransactionRegistry", async () => {
      contract.transactionAudit(TEST_ACCOUNTS.payer, 0, 1).then((ta) => {
        let transactionRegistry = {
          payer: ta[0][0],
          payee: ta[1][0]
        };
        assert.equal(transactionRegistry.payer, TEST_ACCOUNTS.payer);
        assert.equal(transactionRegistry.payee, TEST_ACCOUNTS.payee);
      });
    });

    it("added transaction with correct details", async () => {
      contract.getUserTransactionsDetails(TEST_ACCOUNTS.payer, 0, 1).then((td) => {
        let payerRegistry = {
         amount: td[0][0],
         status: td[1][0],
         ref: td[2][0]
       };
 
       assert.equal(
        payerRegistry.amount.toNumber(),
        web3.toWei(1, "ether") -
        (web3.toWei(1, "ether") / 400)
      );
      assert.equal(payerRegistry.status.toString().replace(/0+$/g, ""), web3.toHex("In Progress"));
      assert.equal(payerRegistry.ref.toString().replace(/0+$/g, ""), web3.toHex("test"));
      });
    });
  });

  describe("Function: acceptTransaction", () => {
    // not sure if these are correct, they are semi correct
    it("prohibited other users from accepting the transaction", async () => {
      try {
        await contract.acceptTransaction(0, {from: TEST_ACCOUNTS.manager});
      } catch (error) {
        // TODO: Check jump destination to destinguish between a throw
        //       and an actual invalid jump.
        const invalidOpcode = error.message.search('invalid opcode') >= 0;
        // TODO: When we contract A calls contract B, and B throws, instead
        //       of an 'invalid jump', we get an 'out of gas' error. How do
        //       we distinguish this from an actual out of gas event? (The
        //       testrpc log actually show an 'invalid jump' event.)
        const outOfGas = error.message.search('out of gas') >= 0;
        const revert = error.message.search('revert') >= 0;
        assert.isTrue(invalidOpcode && !outOfGas && !revert);
      }
    });

    it("allowed payee to accept the transaction when the status is pending", async () => {
      try {
        await contract.acceptTransaction(0, {from: TEST_ACCOUNTS.payee});
      } catch (error) {
        // TODO: Check jump destination to destinguish between a throw
        //       and an actual invalid jump.
        const invalidOpcode = error.message.search('invalid opcode') >= 0;
        // TODO: When we contract A calls contract B, and B throws, instead
        //       of an 'invalid jump', we get an 'out of gas' error. How do
        //       we distinguish this from an actual out of gas event? (The
        //       testrpc log actually show an 'invalid jump' event.)
        const outOfGas = error.message.search('out of gas') >= 0;
        const revert = error.message.search('revert') >= 0;
        assert.isTrue(!invalidOpcode && !outOfGas && revert);
      }
    });   
  });

  describe("Function: cancelTransaction", () => {
    // not sure if these are correct, they are semi correct
    it("prohibited other users from accepting the transaction", async () => {
      try {
        await contract.acceptTransaction(0, {from: TEST_ACCOUNTS.manager});
      } catch (error) {
        // TODO: Check jump destination to destinguish between a throw
        //       and an actual invalid jump.
        const invalidOpcode = error.message.search('invalid opcode') >= 0;
        // TODO: When we contract A calls contract B, and B throws, instead
        //       of an 'invalid jump', we get an 'out of gas' error. How do
        //       we distinguish this from an actual out of gas event? (The
        //       testrpc log actually show an 'invalid jump' event.)
        const outOfGas = error.message.search('out of gas') >= 0;
        const revert = error.message.search('revert') >= 0;
        assert.isTrue(invalidOpcode && !outOfGas && !revert);
      }
    });

    it("allowed payer to cancel the transaction when the status is pending", async () => {
      try {
        await contract.cancelTransaction(0, {from: TEST_ACCOUNTS.payer});
      } catch (error) {
        // TODO: Check jump destination to destinguish between a throw
        //       and an actual invalid jump.
        const invalidOpcode = error.message.search('invalid opcode') >= 0;
        // TODO: When we contract A calls contract B, and B throws, instead
        //       of an 'invalid jump', we get an 'out of gas' error. How do
        //       we distinguish this from an actual out of gas event? (The
        //       testrpc log actually show an 'invalid jump' event.)
        const outOfGas = error.message.search('out of gas') >= 0;
        const revert = error.message.search('revert') >= 0;
        assert.isTrue(!invalidOpcode && !outOfGas && revert);
      }
    });   
  });

  describe("Function: getUserTransactionsCount", () => {
    it("got payer's transaction count", async () => {
      contract.getUserTransactionsCount(TEST_ACCOUNTS.payer, 0).then((c) => {
          assert.equal(c.toNumber(), 1);
      });
    }); 

    it("got payee's transaction count", async () => {
      contract.getUserTransactionsCount(TEST_ACCOUNTS.payee, 1).then((c) => {
          assert.equal(c.toNumber(), 1);
      });
    }); 
  });

  describe("Function: getUserTransactionByID", () => {
    it("got payer's transaction count", async () => {
      contract.getUserTransactionByID(TEST_ACCOUNTS.payer, 0, 0).then((tbid) => {
        let transaction = {
          payer: tbid[0],
          payee: tbid[1],
          manager: tbid[2],
          amount: tbid[3],
          status: tbid[4],
          ref: tbid[5],
        };
        assert.equal(transaction.payer, TEST_ACCOUNTS.payer);
        assert.equal(transaction.payee, TEST_ACCOUNTS.payee);
        assert.equal(transaction.manager, TEST_ACCOUNTS.manager);
        assert.equal(
          transaction.amount.toNumber(),
          web3.toWei(1, "ether") -
          (web3.toWei(1, "ether") / 400)
        );
        assert.equal(transaction.status.toString().replace(/0+$/g, ""), web3.toHex("In Progress"));
        assert.equal(transaction.ref.toString().replace(/0+$/g, ""), web3.toHex("test"));
      });
    }); 

    it("got payee's transaction count", async () => {
      contract.getUserTransactionByID(TEST_ACCOUNTS.payee, 1, 0).then((tbid) => {
        let transaction = {
          payer: tbid[0],
          payee: tbid[1],
          manager: tbid[2],
          amount: tbid[3],
          status: tbid[4],
          ref: tbid[5],
        };
        assert.equal(transaction.payer, TEST_ACCOUNTS.payer);
        assert.equal(transaction.payee, TEST_ACCOUNTS.payee);
        assert.equal(transaction.manager, TEST_ACCOUNTS.manager);
        assert.equal(
          transaction.amount.toNumber(),
          web3.toWei(1, "ether") -
          (web3.toWei(1, "ether") / 400)
        );
        assert.equal(transaction.status.toString().replace(/0+$/g, ""), web3.toHex("In Progress"));
        assert.equal(transaction.ref.toString().replace(/0+$/g, ""), web3.toHex("test"));
      });
    }); 
  });

  describe("Functions: payerAudit", () => {
    it("got payer's transaction audit", async () => {
      contract.payerAudit(TEST_ACCOUNTS.payer, 0, 1).then((pr) => {
        let payerRegistry = {
         payee: pr[0][0],
         manager: pr[1][0]
       };
 
       assert.equal(payerRegistry.payee, TEST_ACCOUNTS.payee);
       assert.equal(payerRegistry.manager, TEST_ACCOUNTS.manager);
      });  
    });
  });

  describe("Functions: payeeAudit", () => {
    it("got payee's transaction audit", async () => {
      contract.payeeAudit(TEST_ACCOUNTS.payee, 0, 1).then((pr) => {
        let payeeRegistry = {
         payer: pr[0][0],
         manager: pr[1][0]
       };
 
       assert.equal(payeeRegistry.payer, TEST_ACCOUNTS.payer);
       assert.equal(payeeRegistry.manager, TEST_ACCOUNTS.manager);
      });  
    });
  });

  describe("Functions: transactionAudit", () => {
    it("got transaction audit", async () => {
      contract.transactionAudit(TEST_ACCOUNTS.payer, 0, 1).then((ta) => {
        let transactionRegistry = {
          payer: ta[0][0],
          payee: ta[1][0]
        };
        assert.equal(transactionRegistry.payer, TEST_ACCOUNTS.payer);
        assert.equal(transactionRegistry.payee, TEST_ACCOUNTS.payee);
      }); 
    });
  });

});