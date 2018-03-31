    pragma solidity ^0.4.16;
    contract VQPayments
    {       
        //@todo
        //check fee calculation formula
        //expireDate: this either requires a polling from outside or poor man's cron
        //like every function runs the job but this will mean that it will constantly require someone accessing contract
        //otherwise it does not get executed and the money stays non-expired state even though the time has already passed
        
        address public owner;

        modifier onlyOwner() {
            require(msg.sender == owner);
            _;
        }

        modifier onlyPayer(uint txID) {
            require(msg.sender == PayerRegistry[msg.sender][txID].payer);
            _;
        }

        modifier onlyPayee(uint txID) {
            require(PayeeRegistry[msg.sender][txID].tx_index > 0);
            _;
        }

        modifier onlyManager() {
            require(ManagerRegistry[msg.sender].exists);
            _;
        }

        modifier onlyWhen(bool _condition) {
            require(_condition);
            _;
        }

        modifier onlyFreeUser() {
            require(LockedUserRegistry[msg.sender] == false);
            _;
        }

        modifier onlyFreeTransaction(address user, uint txID) {
            require(PayerRegistry[user][txID].is_locked == false);
            _;
        }

        modifier hasDeposit() {
            require(checkBalance(msg.sender) > 0);
            _;
        }

        //these are placeholders for expiry functionality of transactions
        //modifier onlyBefore(uint _time) { require(now < _time); _; }
        //modifier onlyAfter(uint _time) { require(now > _time); _; }

        struct Transaction
        {    
            address payer;
            address payee;
            address manager;
                                       
            uint manager_fee;
            uint amount;

            bool is_accepted;
            bool has_dispute;
            bool paid;
            bool refunded;
            bool is_locked;
            bool is_cancelled;

            bytes32 ref;
        }

        struct TransactionReference
        {                        
            address payer;
            uint tx_index;
        }

        struct Manager
        {
            uint fee;
            bool exists;
        }

        mapping(address => Transaction[]) public PayerRegistry;
        mapping(address => TransactionReference[]) public PayeeRegistry;        
        mapping(address => TransactionReference[]) public TransactionRegistry;
        mapping(address => Manager) public ManagerRegistry;
        mapping(address => bool) public LockedUserRegistry;
               
        mapping(address => uint) public Deposits;

        function VQPayments() public
        {
            owner = msg.sender;
        }

        function addManager(
            address manager,
            uint fee
        )
            public
            onlyOwner
            onlyWhen(fee >= 1 && fee <= 100)
        {
            ManagerRegistry[manager].fee = fee;
            ManagerRegistry[manager].exists = true;
        }

        function setManagerFee(
            uint fee
        )
            public
            onlyWhen(fee >= 1 && fee <= 100)
            onlyManager
        {
            ManagerRegistry[msg.sender].fee = fee;
        }

        function getManagerFee(
            address manager
        )
            public
            constant
            returns (
                uint
            ) 
        {
            return ManagerRegistry[manager].fee;
        }
        
        function createTransaction(
            address payee,
            address manager,
            bytes32 ref
        )
            public
            payable
            onlyFreeUser
            onlyWhen(msg.value > 0)
            returns (
                bool
            )
        {
            Transaction memory blankTransaction;
            TransactionReference memory blankTransactionReference;

            // old: Deposits[owner] += msg.value * (msg.value/4000);
            // 0.25%=0.0025 for the owner for the contract (1/4000)
            Deposits[owner] += msg.value / 400; 
            
            blankTransaction.payer = msg.sender;
            blankTransaction.payee = payee;
            blankTransaction.manager = manager;
            blankTransaction.manager_fee = getManagerFee(manager) * msg.value/1000;
            // remove default manager fee. It is only due if parties fight, not by default!
            blankTransaction.amount = msg.value - (msg.value/400) - blankTransaction.manager_fee;
            blankTransaction.ref = ref;

            blankTransactionReference.payer = msg.sender;
            blankTransactionReference.tx_index = PayerRegistry[msg.sender].length;

            PayeeRegistry[payee].push(blankTransactionReference);
            TransactionRegistry[manager].push(blankTransactionReference);
            PayerRegistry[msg.sender].push(blankTransaction);
            
            return true;
        }

        function acceptTransaction(
            uint txID
        )
            public
            onlyFreeUser
            onlyPayee(txID)
            returns (
                bool
            )
        {
            address payer = PayeeRegistry[msg.sender][txID].payer;
            uint _txID = PayeeRegistry[msg.sender][txID].tx_index;
            Transaction storage currentTransaction = PayerRegistry[payer][_txID];

            require(
                currentTransaction.is_accepted == false &&
                currentTransaction.has_dispute == false &&
                currentTransaction.paid == false &&
                currentTransaction.refunded == false &&
                currentTransaction.is_locked == false &&
                currentTransaction.is_cancelled == false
            );

            currentTransaction.is_accepted = true;
            return true;
        }

        function cancelTransaction(
            uint txID
        )
            public
            onlyFreeUser
            onlyPayer(txID)
            returns (
                bool
            )
        {
            Transaction memory currentTransaction = PayerRegistry[msg.sender][txID];

            require(
                currentTransaction.is_accepted == false &&
                currentTransaction.has_dispute == false &&
                currentTransaction.paid == false &&
                currentTransaction.refunded == false &&
                currentTransaction.is_locked == false &&
                currentTransaction.is_cancelled == false
            );

            currentTransaction.is_cancelled = true;
            currentTransaction.refunded = true;
            
            uint manager_fee = getManagerFee(currentTransaction.manager)*currentTransaction.amount/1000;
            //@todo
            uint amount = 0;
            Deposits[currentTransaction.payer] += amount;

            return true;
        }

        function getUserTransactionsCount(
            address user,
            uint userType
        )
            public
            constant
            returns (
                uint
            )
        {
            if (userType == 0)
            {
                return PayerRegistry[user].length;
            }
            else if (userType == 1)
            {
                return PayeeRegistry[user].length;
            }
            return TransactionRegistry[user].length;
        }

        function getUserTransactionByID(
            address user,
            uint userType,
            uint txID
        ) 
            public
            constant
            returns (
                address,
                address, 
                address,
                uint,
                bytes32,
                uint,
                bytes32
            )
        {
            bytes32 status;
            Transaction memory currentTransaction;
            if (userType == 0)
            {
                currentTransaction = PayerRegistry[user][txID];
                status = checkTransactionStatus(user, txID);
            } 
            else if (userType == 1)
            {  
                currentTransaction = PayerRegistry[PayeeRegistry[user][txID].payer][PayeeRegistry[user][txID].tx_index];
                status = checkTransactionStatus(currentTransaction.payer, PayeeRegistry[user][txID].tx_index);
            }   
            else if (userType == 2)
            {        
                currentTransaction = PayerRegistry[TransactionRegistry[user][txID].payer][TransactionRegistry[user][txID].tx_index];
                status = checkTransactionStatus(currentTransaction.payer, TransactionRegistry[user][txID].tx_index);
            }

            return (
                currentTransaction.payer,
                currentTransaction.payee,
                currentTransaction.manager,
                currentTransaction.amount,
                status,
                currentTransaction.manager_fee,
                currentTransaction.ref
            );
        }   

        function payerAudit(
            address payer,
            uint offset,
            uint limit
        )
            public
            constant
            returns (
                address[],
                address[],
                uint[],
                bytes32[]
            )
        {
            uint count;

            if (PayerRegistry[payer].length < limit)
            {
                count = PayerRegistry[payer].length;
            }
            else
            {
                count = limit;
            }
            
            address[] memory payees = new address[](count);
            address[] memory managers = new address[](count);
            uint[] memory amounts = new uint[](count);
            bytes32[] memory statuses = new bytes32[](count);
           
            for (uint i = 0; i < count; i++)
            {
  
                payees[i] = (PayerRegistry[payer][offset + i].payee);
                managers[i] = (PayerRegistry[payer][offset + i].manager);
                amounts[i] = (PayerRegistry[payer][offset + i].amount);
                statuses[i] = checkTransactionStatus(payer, offset + i);
            }
            
            return (
                payees,
                managers,
                amounts,
                statuses
            );
        }
                 
        function payeeAudit(
            address user,
            uint offset,
            uint limit
        )
            public
            constant
            returns (
                address[],
                address[],
                uint[],
                bytes32[]
            )
        {
            address[] memory payers = new address[](limit);
            address[] memory transactions = new address[](limit);
            uint[] memory amounts = new uint[](limit);
            bytes32[] memory statuses = new bytes32[](limit);

            for (uint i = 0; i < limit; i++)
            {
                if (i >= PayeeRegistry[user].length)
                {
                    break;
                }
                    
                payers[i] = PayeeRegistry[user][offset + i].payer;
                transactions[i] = PayerRegistry[payers[i]][PayeeRegistry[user][offset +i].tx_index].manager;
                amounts[i] = PayerRegistry[payers[i]][PayeeRegistry[user][offset + i].tx_index].amount;
                statuses[i] = checkTransactionStatus(payers[i], PayeeRegistry[user][offset + i].tx_index);
            }
            return (payers, transactions, amounts, statuses);
        }

        function TransactionAudit(
            address user,
            uint offset,
            uint limit
        )
            public
            constant
            returns (
                address[],
                address[],
                uint[],
                bytes32[]
            )
        {
            address[] memory payers = new address[](limit);
            address[] memory payees = new address[](limit);
            uint[] memory amounts = new uint[](limit);
            bytes32[] memory statuses = new bytes32[](limit);

            for (uint i = 0; i < limit; i++)
            {
                if (i >= TransactionRegistry[user].length)
                {
                    break;
                }

                payers[i] = TransactionRegistry[user][offset + i].payer;
                payees[i] = PayerRegistry[payers[i]][TransactionRegistry[user][offset +i].tx_index].payee;
                amounts[i] = PayerRegistry[payers[i]][TransactionRegistry[user][offset + i].tx_index].amount;
                statuses[i] = checkTransactionStatus(payers[i], TransactionRegistry[user][offset + i].tx_index);
            }
            return (
                payers,
                payees,
                amounts,
                statuses
            );
        }

        function checkTransactionStatus(
            address payer,
            uint txID
        )
            public
            constant
            returns (
                bytes32
            )
        {
            bytes32 status = "";

            if (PayerRegistry[payer][txID].paid)
            {
                status = "Paid";
            }
            else if (PayerRegistry[payer][txID].refunded)
            {
                status = "Refunded";
            }
            else if (PayerRegistry[payer][txID].has_dispute)
            {
                status = "Awaiting Dispute Resolution";
            }
            else if (PayerRegistry[payer][txID].is_locked) {
                status = "Transaction Locked";
            }
            else if (LockedUserRegistry[payer])
            {
                status = "User Access Locked";
            }
            else
            {
                status = "In Progress";
            }
       
            return status;
        }

        function releaseDeposit(
            uint txID
        )
            public
            payable
            onlyPayer(txID)
            onlyFreeUser
            onlyWhen(txID < PayerRegistry[msg.sender].length)
        {
            require(
                PayerRegistry[msg.sender][txID].paid == false &&
                PayerRegistry[msg.sender][txID].refunded == false &&
                PayerRegistry[msg.sender][txID].is_locked == false
            );
            
            PayerRegistry[msg.sender][txID].paid = true;

            address payee = PayerRegistry[msg.sender][txID].payee;
            address manager = PayerRegistry[msg.sender][txID].manager;

            uint amount = PayerRegistry[msg.sender][txID].amount;
            uint manager_fee = PayerRegistry[msg.sender][txID].manager_fee;

            Deposits[payee] += amount;
            Deposits[manager] += manager_fee;
        }

        function refundDeposit(
            uint txID
        )
            public
            payable
            onlyPayee(txID)
            onlyFreeUser
        {
            address payer = PayeeRegistry[msg.sender][txID].payer;
            uint _txID = PayeeRegistry[msg.sender][txID].tx_index;

            require(
                LockedUserRegistry[payer] == false &&
                PayerRegistry[payer][_txID].paid == false &&
                PayerRegistry[payer][_txID].refunded == false &&
                PayerRegistry[payer][_txID].is_locked == false
            ); 

            address manager = PayerRegistry[payer][_txID].manager;
            uint manager_fee = PayerRegistry[payer][_txID].manager_fee;
            uint amount = PayerRegistry[payer][_txID].amount;

            PayerRegistry[payer][_txID].refunded = true;

            Deposits[payer] += amount;
            Deposits[manager] += manager_fee;
        }

        function lockUserAccess(
            address user
        )
            public
            onlyOwner
        {
            LockedUserRegistry[user] = true;
        }

        function lockTransaction(
            address user,
            uint txID
        )
            public
            onlyOwner
        {
            PayerRegistry[user][txID].is_locked = true;
        }

        function TransactionDispute(
            uint userType,
            uint txID
        )
            public
        {
            address payer;
            uint _txID; //transaction txID of in payer's audit
            if (userType == 0) // payer
            {
                payer = msg.sender;
                _txID = txID;
            } else if (userType == 1) //payee
            {
                payer = PayeeRegistry[msg.sender][txID].payer;
                _txID = PayeeRegistry[msg.sender][txID].tx_index;
            }

            require(
                PayerRegistry[payer][_txID].has_dispute == false  &&
                PayerRegistry[payer][_txID].paid == false &&
                PayerRegistry[payer][_txID].refunded == false &&
                PayerRegistry[payer][_txID].is_locked == false
            );

            PayerRegistry[payer][_txID].has_dispute = true;
        }
        
        function DisputeDecision(
            uint txID,
            uint decision
        ) public
        {
            address payer = TransactionRegistry[msg.sender][txID].payer;
            uint _txID = TransactionRegistry[msg.sender][txID].tx_index;
            
            require(
                LockedUserRegistry[payer] == false &&
                LockedUserRegistry[msg.sender] == false &&
                PayerRegistry[payer][_txID].is_accepted == true &&
                PayerRegistry[payer][_txID].paid == false &&
                PayerRegistry[payer][_txID].has_dispute == true &&
                PayerRegistry[payer][_txID].refunded == false &&
                PayerRegistry[payer][_txID].is_locked == false &&
                PayerRegistry[payer][_txID].is_cancelled == false
            );
            
            uint manager_fee = PayerRegistry[payer][_txID].manager_fee;
            uint amount = PayerRegistry[payer][_txID].amount;

            if (decision == 0) //Refund payer
            {
                PayerRegistry[payer][_txID].refunded = true;    
                Deposits[payer] += amount;
                Deposits[msg.sender] += manager_fee;
                
            }
            else if (decision == 1) //Release funds to payee
            {                
                PayerRegistry[payer][_txID].paid = true;
                Deposits[PayerRegistry[payer][_txID].payee] += amount;
                Deposits[msg.sender] += manager_fee;
            }  
        }
        
        function withdrawDeposits()
            public
            hasDeposit
            onlyFreeUser
        {
            uint amount = Deposits[msg.sender];
            Deposits[msg.sender] = 0;
            if (!msg.sender.send(amount)) {
                Deposits[msg.sender] = amount;
            }
                
        }

        function checkBalance(
            address user
        )
            public
            view
            returns (
                uint
            )
        {
            return Deposits[user];
        }
     
    }
