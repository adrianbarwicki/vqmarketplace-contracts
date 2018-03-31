pragma solidity ^0.4.17;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/VQPayments.sol";

contract TestVQPayments {
    VQPayments vqPayments = VQPayments(DeployedAddresses.VQPayments());

    function testCreateTransaction() public {
        uint returnedId = vqPayments.createTransaction(8);

        uint expected = 8;

        Assert.equal(returnedId, expected, "Adoption of pet ID 8 should be recorded.");
    }
    // Testing the createTransaction() function

    // Testing the getUserTransactions() function
    // Testing the getUserTransaction() function
    
    // Testing the getTransactions() function
    // Testing the getTransaction() function

    // Testing the releaseTransaction() function
    // Testing the releaseUserTransactions() function

    // Testing the refundTransaction() function
    // Testing the refundUserTransactions() function

    // Testing the setTransactionStatus() function

}