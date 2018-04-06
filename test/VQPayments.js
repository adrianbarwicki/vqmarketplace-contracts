require('babel-register');
require('babel-polyfill');

const {
    toHex,
    isAllowed,
    isProhibited,
    expectError,
    deductOwnerFee,
    getOwnerFee,
    calculateGasUsed
} = require('../utils');

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
        PENDING: 0,
        ACCEPTED: 1,
        DISPUTED: 2,
        PAID: 3,
        REFUNDED: 4,
        CANCELLED: 5,
    };
    
    const USER_TYPES = {
        PAYER: 0,
        PAYEE: 1
    }

    const TEST_ACCOUNTS = {
        OWNER: accounts[0],
        PAYER: accounts[1],
        PAYEE: accounts[2],
        MANAGER: accounts[3]
    };

    const TRANSACTION_STATUS = {
        PENDING: "Pending",
        ACCEPTED: "Accepted",
        CANCELLED: "Cancelled",
        PAID: "Paid",
        REFUNDED: "Refunded",
        DISPUTED: "Awaiting Dispute Resolution",

    }

    const TRANSACTION_MOCK = {
        PAYER: TEST_ACCOUNTS.PAYER,
        PAYEE: TEST_ACCOUNTS.PAYEE,
        MANAGER: TEST_ACCOUNTS.MANAGER,
        AMOUNT: web3.toWei(1, "ether"),
        STATUS: TRANSACTION_STATE.PENDING,
        REF: "test",
    }

    const TRANSACTION_REFERENCE_MOCK = {
        PAYER: TEST_ACCOUNTS.PAYER,
        TX_INDEX: (index) => index
    }

    let lastTransactionIndex = 0;

    const createMockTransaction = async (payer = TRANSACTION_MOCK.PAYER) => {
        return {
            transaction: await contract.createTransaction(
                            TRANSACTION_MOCK.PAYEE,
                            TRANSACTION_MOCK.MANAGER,
                            TRANSACTION_MOCK.REF,
                        {
                            value: TRANSACTION_MOCK.AMOUNT,
                            from: payer,
                        }),
            lastTransactionIndex: lastTransactionIndex++
        };
    }
    
    beforeEach('setup contract for each test', async () => {
        return VQPayments.deployed().then((instance) => {
            contract = instance;
        });
    });
    
    it("has the right owner", async () => {
        assert.equal(await contract.owner(), TEST_ACCOUNTS.OWNER);
    });

    describe("Unit Tests", () => {
        describe("Function: createTransaction", () => {
            let transaction;

            before('create a transaction', async () => {
                transaction = await createMockTransaction();
            });

            it("created the transaction", async () => {   
                assert.equal(transaction.transaction.receipt.status, 1);
            });
            
            it("deposited correct amount of money to owner account", async () => {
                const result = await contract.Deposits(TEST_ACCOUNTS.OWNER)
                
                assert.equal(result, getOwnerFee(web3.toWei(1, "ether")));
            });
            
            it("added transaction to PayerRegistry", async () => {
                const result = await contract.PayerRegistry(TEST_ACCOUNTS.PAYER, transaction.lastTransactionIndex);
    
                const transactionRef = {
                    payer: result[0],
                    payee: result[1],
                    manager: result[2],
                    amount: result[3].toNumber(),
                    status: result[4],
                    ref: result[5],
                };
                
                assert.equal(transactionRef.payer, TRANSACTION_MOCK.PAYER);
                assert.equal(transactionRef.payee, TRANSACTION_MOCK.PAYEE);
                assert.equal(transactionRef.manager, TRANSACTION_MOCK.MANAGER);
                assert.equal(transactionRef.amount, deductOwnerFee(TRANSACTION_MOCK.AMOUNT));
                assert.equal(transactionRef.status, TRANSACTION_MOCK.STATUS);
                assert.equal(transactionRef.ref, toHex(TRANSACTION_MOCK.REF));
            });
            
            it("added transaction reference to PayeeRegistry", async () => {
                const result = await contract.PayeeRegistry(TEST_ACCOUNTS.PAYEE, transaction.lastTransactionIndex);

                const transactionRef = {
                    payer: result[0],
                    tx_index: result[1]
                };
                
                assert.equal(transactionRef.payer, TRANSACTION_REFERENCE_MOCK.PAYER);
                assert.equal(transactionRef.tx_index, TRANSACTION_REFERENCE_MOCK.TX_INDEX(transaction.lastTransactionIndex));
            });
        });

        describe("Function: acceptTransaction", () => {
            let transaction;

            beforeEach('create a transaction for each iteration', async () => {
                transaction = await createMockTransaction();
            });

            //only pending state
            //check result status

            it("prohibited other users than the payee from accepting the transaction", async () => {
                try {
                    await contract.acceptTransaction(transaction.lastTransactionIndex, {from: TEST_ACCOUNTS.MANAGER});
                }
                catch (error) {
                    assert.isTrue(isProhibited(error));
                }
            });
            
            it("allowed payee to accept the transaction when the status is pending", async () => {
                const result = await contract.acceptTransaction(transaction.lastTransactionIndex, {from: TEST_ACCOUNTS.PAYEE});
                assert.equal(result.receipt.status, 1);
            });   
        });

        describe("Function: cancelTransaction", () => {
            let transaction;

            beforeEach('create a transaction for each iteration', async () => {
                transaction = await createMockTransaction();
            });

            //only pending state
            //deposit of payer
            //check result status

            it("prohibited other users than the payer from cancelling the transaction", async () => {
                try {
                    await contract.cancelTransaction(transaction.lastTransactionIndex, {from: TEST_ACCOUNTS.MANAGER});
                }
                catch (error) {
                    assert.isTrue(isProhibited(error));
                }
            });
            
            it("allowed payer to cancel the transaction when the status is pending", async () => {
                const result = await contract.cancelTransaction(transaction.lastTransactionIndex, {from: TEST_ACCOUNTS.PAYER});
                assert.equal(result.receipt.status, 1);
            });   
        });

        describe("Function: getUserTransactionsCount", () => {
            const transactions = [];
            const count = 5;

            before('create 5 transactions for test', async () => {
                for (let i = 0; i <= count; i++) {
                    transactions[i] = await createMockTransaction();
                }
            });

            it("got payer's transaction count", async () => {
                const result = await contract.getUserTransactionsCount(TEST_ACCOUNTS.PAYER, USER_TYPES.PAYER);
                assert.equal(result.toNumber(), lastTransactionIndex);
            }); 
            
            it("got payee's transaction count", async () => {
                const result = await contract.getUserTransactionsCount(TEST_ACCOUNTS.PAYEE, USER_TYPES.PAYEE);
                assert.equal(result.toNumber(), lastTransactionIndex);
            }); 
        });

        describe("Function: getUserTransactionByID", () => {
            let transaction;

            beforeEach('create a transaction for each iteration', async () => {
                transaction = await createMockTransaction();
            });

            it("got payer's transaction", async () => {
                const result = await contract.getUserTransactionByID(TEST_ACCOUNTS.PAYER, USER_TYPES.PAYER, transaction.lastTransactionIndex);
                
                const transactionRef = {
                    payer: result[0],
                    payee: result[1],
                    manager: result[2],
                    amount: result[3].toNumber(),
                    status: result[4],
                    ref: result[5],
                };                
                
                assert.equal(transactionRef.payer, TRANSACTION_MOCK.PAYER);
                assert.equal(transactionRef.payee, TRANSACTION_MOCK.PAYEE);
                assert.equal(transactionRef.manager, TRANSACTION_MOCK.MANAGER);
                assert.equal(transactionRef.amount, deductOwnerFee(TRANSACTION_MOCK.AMOUNT));
                assert.equal(transactionRef.status, toHex(TRANSACTION_STATUS.PENDING));
                assert.equal(transactionRef.ref, toHex(TRANSACTION_MOCK.REF));
            }); 
            
            it("got payee's transaction through the reference", async () => {
                const result = await contract.getUserTransactionByID(TEST_ACCOUNTS.PAYEE, USER_TYPES.PAYEE, 0);

                const transactionRef = {
                    payer: result[0],
                    payee: result[1],
                    manager: result[2],
                    amount: result[3].toNumber(),
                    status: result[4],
                    ref: result[5],
                };   

                assert.equal(transactionRef.payer, TRANSACTION_MOCK.PAYER);
                assert.equal(transactionRef.payee, TRANSACTION_MOCK.PAYEE);
                assert.equal(transactionRef.manager, TRANSACTION_MOCK.MANAGER);
                assert.equal(transactionRef.amount, deductOwnerFee(TRANSACTION_MOCK.AMOUNT));
                assert.equal(transactionRef.status, toHex(TRANSACTION_STATUS.PENDING));
                assert.equal(transactionRef.ref, toHex(TRANSACTION_MOCK.REF));
            }); 
        });

        describe("Function: getTransactionStatus", () => {
            it("got Pending status", async () => {
                const transaction = await createMockTransaction();
                const result = await contract.getTransactionStatus(TEST_ACCOUNTS.PAYER, transaction.lastTransactionIndex);
                assert.equal(result, toHex(TRANSACTION_STATUS.PENDING));
            }); 
            
            it("got Accepted status", async () => { 
                const transaction = await createMockTransaction();
                await contract.acceptTransaction(transaction.lastTransactionIndex, {from: TEST_ACCOUNTS.PAYEE});
    
                const result = await contract.getTransactionStatus(TEST_ACCOUNTS.PAYER, transaction.lastTransactionIndex);
                assert.equal(result, toHex(TRANSACTION_STATUS.ACCEPTED));
            }); 

            it("got Cancelled status", async () => { 
                const transaction = await createMockTransaction();
                await contract.cancelTransaction(transaction.lastTransactionIndex, {from: TEST_ACCOUNTS.PAYER});
    
                const result = await contract.getTransactionStatus(TEST_ACCOUNTS.PAYER, transaction.lastTransactionIndex);
                assert.equal(result, toHex(TRANSACTION_STATUS.CANCELLED));
            });
         
            //PAID
            //REFUNDED
            //DISPUTE

        });

        describe("Function: freezeContract", () => {
            //only owner
            //no other user

            it("frozen the contract which blocks createTransaction", async () => { 
                await contract.freezeContract({from: TEST_ACCOUNTS.OWNER});
                const transaction = await createMockTransaction();
                console.log(transaction)
                
                //assert.isTrue(result);
            });
        });     

        /* describe("Functions: releaseDeposit & withdrawDeposits", () => {
            it("releaseDeposit released the deposit to payee's Deposit", async () => {
                const transaction = await contract.getUserTransactionByID(TEST_ACCOUNTS.PAYER, 0, 0);
                const transactionDetails = {
                    amount: transaction[3]
                };
    
                await contract.releaseDeposit(
                    TEST_ACCOUNTS.PAYER,
                    0,
                    { from: TEST_ACCOUNTS.PAYER }
                );
                const result = await contract.Deposits(TEST_ACCOUNTS.PAYEE);
                assert.equal(result.toNumber(), transactionDetails.amount.toNumber());
            });
    
            it("withdrawDeposits released the deposit to payee's account", async () => {
                const transaction = await contract.getUserTransactionByID(TEST_ACCOUNTS.PAYER, 0, 0);
                let transactionDetails = {
                    amount: transaction[3]
                };
    
                const balanceBeforeWithdraw = web3.eth.getBalance(TEST_ACCOUNTS.PAYEE).toNumber();                
    
                const result = await contract.withdrawDeposits({from: TEST_ACCOUNTS.PAYEE});
    
                const t = web3.eth.getTransaction(result.receipt.transactionHash);
                
                const depositedAmount = transactionDetails.amount.toNumber();
                const currentBalance = await (web3.eth.getBalance(TEST_ACCOUNTS.PAYEE)).toNumber();
                const balanceAfterWithdraw = (depositedAmount + balanceBeforeWithdraw) - calculateGasUsed(t.gasPrice, result.receipt.gasUsed).toNumber();
                
                assert.equal(currentBalance, balanceAfterWithdraw);
            });
    
        }); */

        
        
    });       
});