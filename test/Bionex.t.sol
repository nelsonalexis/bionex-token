// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Bionex} from "../src/Bionex.sol";

contract BionexTest is Test {
    Bionex public bionex;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint256 public constant INITIAL_SUPPLY = 1_000_000 * 10 ** 18;

    function setUp() public {
        // Dans les tests, Alice déploie le contrat.
        vm.prank(alice);
        bionex = new Bionex();
    }

    function testTokenInformation() public view {
        assertEq(bionex.name(), "Bionex");
        assertEq(bionex.symbol(), "BNX");
        assertEq(bionex.decimals(), 18);
    }

    function testInitialSupplyGoesToDeployer() public view {
        assertEq(bionex.totalSupply(), INITIAL_SUPPLY);
        assertEq(bionex.balanceOf(alice), INITIAL_SUPPLY);
    }

    function testTransfer() public {
        uint256 amount = 100 * 10 ** 18;

        vm.prank(alice);
        bionex.transfer(bob, amount);

        assertEq(bionex.balanceOf(bob), amount);
        assertEq(bionex.balanceOf(alice), INITIAL_SUPPLY - amount);
    }

    function testBurn() public {
        uint256 amount = 50 * 10 ** 18;

        vm.prank(alice);
        bionex.burn(amount);

        assertEq(bionex.balanceOf(alice), INITIAL_SUPPLY - amount);
        assertEq(bionex.totalSupply(), INITIAL_SUPPLY - amount);
    }

    function testTransferFailsWhenBalanceIsInsufficient() public {
        uint256 amount = 1 * 10 ** 18;

        vm.prank(bob);
        vm.expectRevert();
        bionex.transfer(alice, amount);
    }
}
