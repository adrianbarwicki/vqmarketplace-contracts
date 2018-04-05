require('babel-register')
require('babel-polyfill')
const _ = require('lodash');

//const expectThrow = require('./expectThrow.js');
//const expectCorrectUser = require('./expectCorrectUser.js');

const VQPayments = artifacts.require('../contracts/VQPayments.sol');

contract('VQPayments', async (accounts) => {
    
    //KEEP IN MIND
    //1)    tests fail randomly so rerun them

    //2)    the tests are being tested on a single transaction/user
    //      so remember to always revert the state change that you make
    //      to transaction and users

    //3)    if you do transaction by another user and want to calculate the before and after balance
    //      check withdraw test, it contains an example on how to correctly calculate
    //      the gas used

    const TRANSACTION_STATE = {
        is_accepted: "is_accepted",
        has_dispute: "has_dispute",
        paid: "paid",
        refunded: "refunded",
        is_locked: "is_locked",
        is_cancelled: "is_cancelled"
    };
    
    const TEST_ACCOUNTS = {
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

    describe("Function: createTransaction", () => {
        it("created the transaction", async () => {
            const result = await contract.createTransaction(
                TEST_ACCOUNTS.payee, //payee
                TEST_ACCOUNTS.manager, //manager
                web3.toHex("test"), //ref
            {
                value: web3.toWei(1, "ether"), //1000000000000000000 wei
                from: TEST_ACCOUNTS.payer, //payer
                gas: 1000000
            });

            assert.equal(result.receipt.status, 1);
        });
        
        it("deposited correct amount of money to owner account", async () => {
            const result = await contract.Deposits(TEST_ACCOUNTS.owner)
            
            assert.equal(result, web3.toWei(1, "ether") / 400);
        });
        
        it("added transaction to PayerRegistry", async () => {
            const result = await contract.payerAudit(TEST_ACCOUNTS.payer, 0, 1);

            let payerRegistry = {
                payee: result[0][0],
                manager: result[1][0]
            };
            
            assert.equal(payerRegistry.payee, TEST_ACCOUNTS.payee);
            assert.equal(payerRegistry.manager, TEST_ACCOUNTS.manager);
        });
        
        it("added transaction to PayeeRegistry", async () => {
            await contract.payeeAudit(TEST_ACCOUNTS.payee, 0, 5).then((pr) => {
                let payeeRegistry = {
                    payer: pr[0][0],
                    manager: pr[1][0]
                };
                
                assert.equal(payeeRegistry.payer, TEST_ACCOUNTS.payer);
                assert.equal(payeeRegistry.manager, TEST_ACCOUNTS.manager);
            });
        });
        
        it("added transaction to TransactionRegistry", async () => {
            await contract.transactionAudit(TEST_ACCOUNTS.payer, 0, 1).then((ta) => {
                let transactionRegistry = {
                    payer: ta[0][0],
                    payee: ta[1][0]
                };
                assert.equal(transactionRegistry.payer, TEST_ACCOUNTS.payer);
                assert.equal(transactionRegistry.payee, TEST_ACCOUNTS.payee);
            });
        });
        
        it("added transaction with correct details", async () => {
            await contract.getUserTransactionsDetails(TEST_ACCOUNTS.payer, 0, 1).then((td) => {
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
            //revert to original state
            await contract.setTransactionStatus(
                TEST_ACCOUNTS.payer,
                0,
                web3.toHex("is_cancelled"),
                false,
                { from: TEST_ACCOUNTS.owner }
            );
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
            //revert to original state
            await contract.setTransactionStatus(
                TEST_ACCOUNTS.payer,
                0,
                web3.toHex("is_accepted"),
                false,
                { from: TEST_ACCOUNTS.owner }
            ); 
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
            //revert to original state
            await contract.setTransactionStatus(
                TEST_ACCOUNTS.payer,
                0,
                web3.toHex("is_cancelled"),
                false,
                { from: TEST_ACCOUNTS.owner }
            );
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
            //revert to original state
            await contract.setTransactionStatus(
                TEST_ACCOUNTS.payer,
                0,
                web3.toHex("is_cancelled"),
                false,
                { from: TEST_ACCOUNTS.owner }
            ); 
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
    
    describe("Functions: payerAudit, payeeAudit, transactionAudit", () => {
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
    
    describe("Functions: setTransactionStatus and getTransactionStatus", () => { 
        it("set and got In Progress status", async () => { 
            await contract.setTransactionStatus(
                TEST_ACCOUNTS.payer,
                0,
                web3.toHex("is_accepted"),
                false,
                { from: TEST_ACCOUNTS.owner }
            ).then(async (ts) => { 
                await contract.getTransactionStatus(TEST_ACCOUNTS.payer, 0).then(async (ts2) => { 
                    assert.equal(ts2, _.padEnd(web3.toHex("In Progress"), 66, '0'));                        
                });  
            });
        }); 
        
        it("set and got Transaction Accepted status", async () => { 
            await contract.setTransactionStatus(
                TEST_ACCOUNTS.payer,
                0,
                web3.toHex("is_accepted"),
                true,
                { from: TEST_ACCOUNTS.owner }
            ).then(async (ts) => { 
                await contract.getTransactionStatus(TEST_ACCOUNTS.payer, 0).then(async (ts2) => { 
                    assert.equal(ts2, _.padEnd(web3.toHex("Transaction Accepted"), 66, '0'));
                    //revert to original state
                    await contract.setTransactionStatus(
                        TEST_ACCOUNTS.payer,
                        0,
                        web3.toHex("is_accepted"),
                        false,
                        { from: TEST_ACCOUNTS.owner }
                    ); 
                });  
            });
        }); 
        
        it("set and got Paid status", async () => { 
            await contract.setTransactionStatus(
                TEST_ACCOUNTS.payer,
                0,
                web3.toHex("paid"),
                true,
                { from: TEST_ACCOUNTS.owner }
            ).then(async (ts) => { 
                await contract.getTransactionStatus(TEST_ACCOUNTS.payer, 0).then(async (ts2) => { 
                    assert.equal(ts2, _.padEnd(web3.toHex("Paid"), 66, '0'));
                    
                    //revert to original state
                    await contract.setTransactionStatus(
                        TEST_ACCOUNTS.payer,
                        0,
                        web3.toHex("paid"),
                        false,
                        { from: TEST_ACCOUNTS.owner }
                    );          
                });  
            });
        }); 
        
        it("set and got Refunded status", async () => { 
            await contract.setTransactionStatus(
                TEST_ACCOUNTS.payer,
                0,
                web3.toHex("refunded"),
                true,
                { from: TEST_ACCOUNTS.owner }
            ).then(async (ts) => { 
                await contract.getTransactionStatus(TEST_ACCOUNTS.payer, 0).then(async (ts2) => { 
                    assert.equal(ts2, _.padEnd(web3.toHex("Refunded"), 66, '0'));
                    //revert to original state
                    await contract.setTransactionStatus(
                        TEST_ACCOUNTS.payer,
                        0,
                        web3.toHex("refunded"),
                        false,
                        { from: TEST_ACCOUNTS.owner }
                    );
                });  
            });
        }); 
        
        it("set and got Awaiting Dispute Resolution status", async () => { 
            await contract.setTransactionStatus(
                TEST_ACCOUNTS.payer,
                0,
                web3.toHex("has_dispute"),
                true,
                { from: TEST_ACCOUNTS.owner }
            ).then(async (ts) => { 
                await contract.getTransactionStatus(TEST_ACCOUNTS.payer, 0).then(async (ts2) => { 
                    assert.equal(ts2, _.padEnd(web3.toHex("Awaiting Dispute Resolution"), 66, '0'));
                    //revert to original state
                    await contract.setTransactionStatus(
                        TEST_ACCOUNTS.payer,
                        0,
                        web3.toHex("has_dispute"),
                        false,
                        { from: TEST_ACCOUNTS.owner }
                    );
                });  
            });
        }); 
        
        it("set and got Transaction Locked status", async () => { 
            await contract.setTransactionStatus(
                TEST_ACCOUNTS.payer,
                0,
                web3.toHex("is_locked"),
                true,
                { from: TEST_ACCOUNTS.owner }
            ).then(async (ts) => { 
                await contract.getTransactionStatus(TEST_ACCOUNTS.payer, 0).then(async (ts2) => { 
                    assert.equal(ts2, _.padEnd(web3.toHex("Transaction Locked"), 66, '0'));
                    //revert to original state
                    await contract.setTransactionStatus(
                        TEST_ACCOUNTS.payer,
                        0,
                        web3.toHex("is_locked"),
                        false,
                        { from: TEST_ACCOUNTS.owner }
                    );
                });  
            });
        });  
    });  

    describe("Function: lockUnlockUserAccess", () => { 
        it("set and got User Access Locked status", async () => { 
            await contract.lockUnlockUserAccess(
                TEST_ACCOUNTS.payer,
                0, //locking
                { from: TEST_ACCOUNTS.owner }
            ).then(async (ts) => { 
                await contract.getTransactionStatus(TEST_ACCOUNTS.payer, 0).then(async (ts2) => { 
                    assert.equal(ts2, _.padEnd(web3.toHex("User Access Locked"), 66, '0'));
                    //revert to original state
                    await contract.lockUnlockUserAccess(
                        TEST_ACCOUNTS.payer,
                        1,
                        { from: TEST_ACCOUNTS.owner }
                    );
                });  
            });
        });
    });     

    describe("Function: lockUnlockTransaction", () => { 
        it("set and got Transaction Locked status", async () => { 
            await contract.lockUnlockTransaction(
                TEST_ACCOUNTS.payer,
                0,
                0, //locking
                { from: TEST_ACCOUNTS.owner }
            ).then(async (ts) => { 
                await contract.getTransactionStatus(TEST_ACCOUNTS.payer, 0).then(async (ts2) => { 
                    assert.equal(ts2, _.padEnd(web3.toHex("Transaction Locked"), 66, '0'));
                    //revert to original state
                    await contract.lockUnlockTransaction(
                        TEST_ACCOUNTS.payer,
                        0,
                        1,
                        { from: TEST_ACCOUNTS.owner }
                    );
                });  
            });
        });
    });     

    describe("Functions: releaseDeposit & withdrawDeposits", () => {
        it("releaseDeposit released the deposit to payee's Deposit", async () => {
            await contract.getUserTransactionByID(TEST_ACCOUNTS.payer, 0, 0).then(async (tbid) => {
                let transaction = {
                    amount: tbid[3]
                };

                await contract.releaseDeposit(
                    TEST_ACCOUNTS.payer,
                    0,
                    { from: TEST_ACCOUNTS.payer }
                ).then(async (ts) => { 
                    await contract.Deposits(TEST_ACCOUNTS.payee).then((od) => {
                        assert.equal(od.toNumber(), transaction.amount.toNumber());
                    });  
                });
            }); 
        });

        it("withdrawDeposits released the deposit to payee's account", async () => {
            await contract.getUserTransactionByID(TEST_ACCOUNTS.payer, 0, 0).then(async (tbid) => {
                let transaction = {
                    amount: tbid[3]
                };

                const balanceBeforeWithdraw = web3.eth.getBalance(TEST_ACCOUNTS.payee).toNumber();                

                await contract.withdrawDeposits({from: TEST_ACCOUNTS.payee}).then(async (tx) => {
                    const t = web3.eth.getTransaction(tx.receipt.transactionHash);
                    const depositedAmount = transaction.amount.toNumber();
                    const currentBalance = await (web3.eth.getBalance(TEST_ACCOUNTS.payee)).toNumber();
                    const balanceAfterWithdraw = (depositedAmount + balanceBeforeWithdraw) - t.gasPrice.mul(tx.receipt.gasUsed).toNumber();
                    
                    assert.equal(currentBalance, balanceAfterWithdraw);
                });
            }); 
        });

    });
        
});