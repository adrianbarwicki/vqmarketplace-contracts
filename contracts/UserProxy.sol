pragma solidity ^0.4.17;
import * as VQPayments from "./VQPayments.sol";

//Serves as a middleware for mimicing another user than the owner for testing modifiers

contract UserProxy {
    address public user;
    bytes data;

    function UserProxy() public {
        user = msg.sender;
    }

    function changeUser(address _user) public returns (bool) {
        user = _user;
    }

    function getInstance() public view returns (bytes32[]) {
        VQPayments paymentInstance = VQPayments(msg.sender);
        return paymentInstance;
    }
}