# Bionex (BNX)

An educational ERC-20 token built with Solidity, OpenZeppelin Contracts and Foundry.

## Token specifications

- Name: Bionex
- Symbol: BNX
- Decimals: 18
- Initial supply: 1,000,000 BNX
- All tokens allocated to the deployer
- No additional minting after deployment
- Burning supported, including allowance-based burning

## Deployment

- Network: Ethereum Sepolia
- Chain ID: 11155111
- Contract: 0xC6315f52C537B61D77802ca6d7d1cBa6D983B782
- Sourcify verification: match

Contract explorer:
https://sepolia.etherscan.io/address/0xC6315f52C537B61D77802ca6d7d1cBa6D983B782

## Build and test

After cloning this repository, run:

    git submodule update --init --recursive
    forge build
    forge test -vv

## Tests

Five Bionex tests cover token metadata, initial allocation,
transfers, burning and transfers with insufficient balance.

## Learning objectives

- Implement an ERC-20 token using OpenZeppelin
- Write Solidity tests with Foundry
- Deploy using browser-wallet signing
- Read blockchain data with Cast
- Verify published source code

## Scope

This is an educational project on a test network.
Source verification is not a security audit.
