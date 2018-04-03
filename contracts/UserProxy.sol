pragma solidity ^0.4.17;
import "./VQPayments.sol";

//Serves as a middleware for mimicing another user than the owner for testing modifiers

contract UserProxy {
    address public user;
    bytes data;

    function UserProxy(address _user) public {
        user = _user;
    }

    function changeUser(address _user) public returns (bool) {
        user = _user;
    }

    function getInstance() public view returns (VQPayments) {
        return VQPayments(user);
    }
}