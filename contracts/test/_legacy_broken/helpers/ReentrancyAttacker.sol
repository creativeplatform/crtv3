// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../CreatorIPCollection.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/**
 * @title ReentrancyAttacker
 * @dev Contract to test reentrancy protection in CreatorIPCollection
 */
contract ReentrancyAttacker is IERC721Receiver {
    CreatorIPCollection public target;
    address public owner;
    bool public attacking;

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Set the target collection to attack
     */
    function setTarget(CreatorIPCollection _target) external {
        require(msg.sender == owner, "Only owner");
        target = _target;
    }

    /**
     * @dev Attack function that tries to reenter during minting
     */
    function attack() external {
        require(msg.sender == owner, "Only owner");
        attacking = true;
        // This will fail if reentrancy protection is working
        try target.mintIP(address(this)) {
            // If we get here, reentrancy protection failed
            revert("Reentrancy attack succeeded - protection failed!");
        } catch {
            // Expected - reentrancy protection should prevent this
            attacking = false;
        }
    }

    /**
     * @dev ERC721Receiver implementation - called during _safeMint
     * This is where we try to reenter
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    ) external returns (bytes4) {
        if (attacking && address(target) != address(0)) {
            // Try to reenter by calling mintIP again
            try target.mintIP(address(this)) {
                revert("Reentrancy attack succeeded!");
            } catch {
                // Expected - should be blocked
            }
        }
        return this.onERC721Received.selector;
    }
}

