pragma solidity ^0.4.17;

contract VQPayments
{       
    //@todo
    //check fee calculation formula
    //expireDate: this either requires a polling from outside or poor man's cron
    //like every function runs the job but this will mean that it will constantly require someone accessing contract
    //otherwise it does not get executed and the money stays non-expired state even though the time has already passed

    //KEEP IN MIND
    //16 variable limit on functions
    //large contract size causing out of gas error so always refactor
    
    address public owner;

    modifier onlyOwner()
    {
        require(msg.sender == owner);
        _;
    }

    modifier onlyPayer(uint txID)
    {
        require(msg.sender == PayerRegistry[msg.sender][txID].payer);
        _;
    }

    modifier onlyPayee(uint txID)
    {
        require(PayeeRegistry[msg.sender][txID].tx_index > 0);
        _;
    }

    modifier onlyWhen(bool condition)
    {
        require(condition);
        _;
    }

    modifier onlyFreeUser()
    {
        require(LockedUserRegistry[msg.sender] == false);
        _;
    }

    modifier onlyFreeTransaction(address user, uint txID)
    {
        require(PayerRegistry[user][txID].is_locked == false);
        _;
    }

    modifier hasDeposit()
    {
        require(Deposits[msg.sender] > 0);
        _;
    } 
    
    modifier onlyBefore(uint time)
    {
        require(now < time);
        _;
    }

    modifier onlyAfter(uint time)
    {
        require(now > time);
        _;
    }

    enum TransactionStatus
    {
        PENDING,
        ACCEPTED,
        DISPUTED,
        PAID,
        REFUNDED,
        CANCELLED
    }

    enum AccessAction
    {
        LOCK,
        UNLOCK
    }

    enum UserType
    {
        PAYER,
        PAYEE
    }

    struct Transaction
    {    
        address payer;
        address payee;
        address manager;

        uint amount;

        TransactionStatus status;
        bool is_locked;

        bytes32 ref;
    }

    struct TransactionReference
    {                        
        address payer;
        uint tx_index;
    }

    mapping(address => Transaction[]) public PayerRegistry;
    mapping(address => TransactionReference[]) public PayeeRegistry;        
    mapping(address => bool) public LockedUserRegistry;
    mapping(address => uint) public Deposits;

    function VQPayments() public
    {
        owner = msg.sender;
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

        Deposits[owner] += msg.value / 400; 
        
        blankTransaction.payer = msg.sender;
        blankTransaction.payee = payee;
        blankTransaction.manager = manager;
        blankTransaction.amount = msg.value - (msg.value/400);
        blankTransaction.status = TransactionStatus.PENDING;
        blankTransaction.is_locked = false;
        blankTransaction.ref = ref;

        blankTransactionReference.payer = msg.sender;
        blankTransactionReference.tx_index = PayerRegistry[msg.sender].length;

        PayerRegistry[msg.sender].push(blankTransaction);
        PayeeRegistry[payee].push(blankTransactionReference);
        
        return true;
    }

    function acceptTransaction(
        uint txID
    )
        public
        onlyFreeUser
        onlyPayee(txID)
        onlyWhen(PayerRegistry[PayeeRegistry[msg.sender][txID].payer][txID].status == TransactionStatus.PENDING)
        returns (
            bool
        )
    {
        address payer = PayeeRegistry[msg.sender][txID].payer;
        uint _txID = PayeeRegistry[msg.sender][txID].tx_index;
        Transaction storage currentTransaction = PayerRegistry[payer][_txID];

        currentTransaction.status = TransactionStatus.ACCEPTED;

        return true;
    }

    function cancelTransaction(
        uint txID
    )
        public
        onlyFreeUser
        onlyPayer(txID)
        onlyWhen(PayerRegistry[msg.sender][txID].status == TransactionStatus.PENDING)
        returns (
            bool
        )
    {
        Transaction storage currentTransaction = PayerRegistry[msg.sender][txID];

        currentTransaction.status = TransactionStatus.CANCELLED;
        
        Deposits[currentTransaction.payer] += currentTransaction.amount;

        return true;
    }

    function getUserTransactionsCount(
        address user,
        uint userType
    )
        public
        view
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
    }

    function getUserTransactionByID(
        address user,
        uint userType,
        uint txID
    ) 
        public
        view
        returns (
            address,
            address, 
            address,
            uint,
            bytes32,
            bool,
            bytes32
        )
    {
        bytes32 status;
        Transaction memory currentTransaction;
        if (userType == 0)
        {
            currentTransaction = PayerRegistry[user][txID];
            status = getTransactionStatus(user, txID);
        } 
        else if (userType == 1)
        {  
            currentTransaction = PayerRegistry[
                PayeeRegistry[user][txID].payer
            ][
                PayeeRegistry[user][txID].tx_index
            ];
            status = getTransactionStatus(currentTransaction.payer, PayeeRegistry[user][txID].tx_index);
        }   

        return (
            currentTransaction.payer,
            currentTransaction.payee,
            currentTransaction.manager,
            currentTransaction.amount,
            status,
            currentTransaction.is_locked,
            currentTransaction.ref
        );
    }   

    /* function getAllUserTransactions(
        address user,
        uint userType,
        uint offset,
        uint limit
    )
        public
        view
        returns (
            address[],
            address[], 
            address[],
            uint[],
            bytes32[],
            bool[],
            bytes32[]
        )
    {
        uint count;

        address[] memory payers = new address[](count);
        address[] memory payees = new address[](count);
        address[] memory managers = new address[](count);
        uint[] memory amounts = new uint[](count);
        bytes32[] memory statuses = new bytes32[](count);
        bool[] memory is_lockeds = new bool[](count);
        bytes32[] memory refs = new bytes32[](count);

        if (userType == 0)
        {
            if (PayerRegistry[user].length < limit)
            {
                count = PayerRegistry[user].length;
            }
            else
            {
                count = limit;
            }

            for (uint i = 0; i < count; i++)
            {
                payers[i] = PayerRegistry[user][offset + i].payer;
                payees[i] = PayerRegistry[user][offset + i].payee;
                managers[i] = PayerRegistry[user][offset + i].manager;
                amounts[i] = PayerRegistry[user][offset + i].amount;
                statuses[i] = getTransactionStatus(user, offset + i);
                is_lockeds[i] = PayerRegistry[user][offset + i].is_locked;
                refs[i] = PayerRegistry[user][offset + i].ref;
            }
        } 
        else if (userType == 1)
        {
            if (
                PayeeRegistry[user].length < limit
            )
            {
                count = PayeeRegistry[user].length;
            }
            else
            {
                count = limit;
            }

            for (uint j = 0; j < count; j++)
            {
                payers[j] = PayerRegistry[
                    PayeeRegistry[user][offset + j].payer
                ][
                    PayeeRegistry[user][offset + j].tx_index
                ].payer;

                payees[j] = PayerRegistry[
                    PayeeRegistry[user][offset + j].payer
                ][
                    PayeeRegistry[user][offset + j].tx_index
                ].payee;

                managers[j] = PayerRegistry[
                    PayeeRegistry[user][offset + j].payer
                ][
                    PayeeRegistry[user][offset + j].tx_index
                ].manager;

                amounts[j] = PayerRegistry[
                    PayeeRegistry[user][offset + j].payer
                ][
                    PayeeRegistry[user][offset + j].tx_index
                ].amount;

                statuses[j] = getTransactionStatus(PayeeRegistry[user][offset + j].payer, PayeeRegistry[user][offset + j].tx_index);

                is_lockeds[j] = PayerRegistry[
                    PayeeRegistry[user][offset + j].payer
                ][
                    PayeeRegistry[user][offset + j].tx_index
                ].is_locked;

                refs[j] = PayerRegistry[
                    PayeeRegistry[user][offset + j].payer
                ][
                    PayeeRegistry[user][offset + j].tx_index
                ].ref;
            }
        }   
        
        
        return (
            payers,
            payees,
            managers,
            amounts,
            statuses,
            is_lockeds,
            refs
        );
    } */

    function getTransactionStatus(
        address payer,
        uint txID
    )
        public
        view
        returns (
            bytes32
        )
    {
        bytes32 status = "";

        if (LockedUserRegistry[payer] == true)
        {
            status = "User Access Locked";
        }
        else if (PayerRegistry[payer][txID].is_locked == true)
        {
            status = "Locked";
        }
        else if (PayerRegistry[payer][txID].status == TransactionStatus.PENDING)
        {
            status = "Pending";
        }
        else if (PayerRegistry[payer][txID].status == TransactionStatus.ACCEPTED)
        {
            status = "Accepted";
        }
        else if (PayerRegistry[payer][txID].status == TransactionStatus.CANCELLED)
        {
            status = "Cancelled";
        }
        else if (PayerRegistry[payer][txID].status == TransactionStatus.PAID)
        {
            status = "Paid";
        }
        else if (PayerRegistry[payer][txID].status == TransactionStatus.REFUNDED)
        {
            status = "Refunded";
        }
        else if (PayerRegistry[payer][txID].status == TransactionStatus.DISPUTED)
        {
            status = "Awaiting Dispute Resolution";
        }
        
        return status;
    }

    function releaseDeposit(
        address user,
        uint txID
    )
        public
        payable
        onlyPayer(txID)
        onlyFreeUser
        onlyWhen(txID < PayerRegistry[user].length)
        onlyWhen(PayerRegistry[msg.sender][txID].status == TransactionStatus.ACCEPTED)
    {       
        PayerRegistry[user][txID].status = TransactionStatus.PAID;

        address payee = PayerRegistry[user][txID].payee;
        uint amount = PayerRegistry[user][txID].amount;

        Deposits[payee] += amount;
    }

    function lockUnlockUserAccess(
        address user,
        AccessAction action      
    )
        public
        onlyOwner
        returns (
            bool
        )
    {
        if (action == AccessAction.LOCK)
        {
            LockedUserRegistry[user] = true;
        }
        else if (action == AccessAction.UNLOCK)
        {
            LockedUserRegistry[user] = false;
        }
        return true;
    }

    function lockUnlockTransaction(
        address payer,
        uint txID,
        AccessAction action
    )
        public
        onlyOwner
        returns (
            bool
        )
    {
        if (action == AccessAction.LOCK)
        {
            PayerRegistry[payer][txID].is_locked = true;
        }
        else if (action == AccessAction.UNLOCK)
        {
            PayerRegistry[payer][txID].is_locked = false;
        }
        return true;
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
    
}
