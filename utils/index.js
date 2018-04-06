require('babel-register');
require('babel-polyfill');

const _ = require('lodash');

const toHex = function(string) {
    return _.padEnd(web3.toHex(string), 66, '0');
}

const isProhibited = function(error) {
    // TODO: Check jump destination to destinguish between a throw
    //       and an actual invalid jump.
    const invalidOpcode = error.message.search('invalid opcode') >= 0;
    // TODO: When we contract A calls contract B, and B throws, instead
    //       of an 'invalid jump', we get an 'out of gas' error. How do
    //       we distinguish this from an actual out of gas event? (The
    //       testrpc log actually show an 'invalid jump' event.)
    const outOfGas = error.message.search('out of gas') >= 0;
    const revert = error.message.search('revert') >= 0;

    return (invalidOpcode && !outOfGas && !revert);
}

const isAllowed = function(error) {
    // TODO: Check jump destination to destinguish between a throw
    //       and an actual invalid jump.
    const invalidOpcode = error.message.search('invalid opcode') >= 0;
    // TODO: When we contract A calls contract B, and B throws, instead
    //       of an 'invalid jump', we get an 'out of gas' error. How do
    //       we distinguish this from an actual out of gas event? (The
    //       testrpc log actually show an 'invalid jump' event.)
    const outOfGas = error.message.search('out of gas') >= 0;
    const revert = error.message.search('revert') >= 0;

    return (!invalidOpcode && !outOfGas && revert);
}

const expectError = function(error) {
    // TODO: Check jump destination to destinguish between a throw
    //       and an actual invalid jump.
    const invalidOpcode = error.message.search('invalid opcode') >= 0;
    // TODO: When we contract A calls contract B, and B throws, instead
    //       of an 'invalid jump', we get an 'out of gas' error. How do
    //       we distinguish this from an actual out of gas event? (The
    //       testrpc log actually show an 'invalid jump' event.)
    const outOfGas = error.message.search('out of gas') >= 0;
    const revert = error.message.search('revert') >= 0;

    return (invalidOpcode || outOfGas || revert);
}

const ownerFeeRatio = 400;

const deductOwnerFee = function(number) {
    return (number - (number / ownerFeeRatio));
}

const getOwnerFee = function(number) {
    return (number / ownerFeeRatio);
}

const calculateGasUsed = function(gasPrice, gasUsed) {
    return gasPrice.mul(gasUsed);
}


module.exports = {
    toHex,
    isAllowed,
    isProhibited,
    expectError,
    ownerFeeRatio,
    deductOwnerFee,
    getOwnerFee,
    calculateGasUsed
}