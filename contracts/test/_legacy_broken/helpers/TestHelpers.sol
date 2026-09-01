// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

/**
 * @title TestHelpers
 * @dev Helper utilities for testing CreatorIPFactory and CreatorIPCollection
 */
library TestHelpers {
    /**
     * @dev Generate a random address for testing
     * @param seed Seed for address generation
     */
    function makeAddr(string memory seed) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(seed)))));
    }

    /**
     * @dev Generate multiple random addresses
     * @param count Number of addresses to generate
     * @param prefix Prefix for address generation
     */
    function makeAddrs(uint256 count, string memory prefix) 
        internal 
        pure 
        returns (address[] memory) 
    {
        address[] memory addrs = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            addrs[i] = makeAddr(string(abi.encodePacked(prefix, i)));
        }
        return addrs;
    }

    /**
     * @dev Generate random string for collection names/symbols
     * @param length Desired string length
     * @param seed Seed for generation
     */
    function randomString(uint256 length, uint256 seed) 
        internal 
        pure 
        returns (string memory) 
    {
        bytes memory chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        bytes memory result = new bytes(length);
        for (uint256 i = 0; i < length; i++) {
            result[i] = chars[uint256(keccak256(abi.encodePacked(seed, i))) % chars.length];
        }
        return string(result);
    }
}

