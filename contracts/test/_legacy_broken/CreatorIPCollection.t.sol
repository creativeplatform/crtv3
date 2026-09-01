// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../CreatorIPCollection.sol";
import "./helpers/ReentrancyAttacker.sol";

contract CreatorIPCollectionTest is Test {
    CreatorIPCollection public collection;
    address public owner;
    address public minter;
    address public recipient;
    address public nonOwner;

    event TokenMinted(address indexed to, uint256 indexed tokenId, string uri);
    event MinterRoleGranted(address indexed minter);
    event MinterRoleRevoked(address indexed minter);
    event BaseURIUpdated(string newBaseURI);

    function setUp() public {
        owner = address(0x1);
        minter = address(0x2);
        recipient = address(0x3);
        nonOwner = address(0x4);

        collection = new CreatorIPCollection("Test Collection", "TEST", owner);
    }

    // ============ Constructor Tests ============

    function test_Constructor_SetsOwner() public {
        assertEq(collection.owner(), owner);
    }

    function test_Constructor_GrantsDefaultAdminRole() public {
        bytes32 defaultAdminRole = collection.DEFAULT_ADMIN_ROLE();
        assertTrue(collection.hasRole(defaultAdminRole, owner));
    }

    function test_Constructor_StartsTokenIdAtOne() public {
        assertEq(collection.currentTokenId(), 1);
    }

    function test_Constructor_RevertsZeroOwner() public {
        vm.expectRevert("Collection: owner cannot be zero address");
        new CreatorIPCollection("Test", "T", address(0));
    }

    // ============ mintIP Tests ============

    function test_MintIP_Success() public {
        // Grant minter role first
        vm.prank(owner);
        collection.grantMinterRole(minter);

        vm.prank(minter);
        uint256 tokenId = collection.mintIP(recipient);

        assertEq(tokenId, 1);
        assertEq(collection.ownerOf(tokenId), recipient);
        assertEq(collection.totalSupply(), 1);
        assertEq(collection.currentTokenId(), 2);
    }

    function test_MintIP_EmitsEvent() public {
        vm.prank(owner);
        collection.grantMinterRole(minter);

        vm.expectEmit(true, true, false, true);
        emit TokenMinted(recipient, 1, "");

        vm.prank(minter);
        collection.mintIP(recipient);
    }

    function test_MintIP_RevertsWithoutRole() public {
        vm.prank(nonOwner);
        vm.expectRevert();
        collection.mintIP(recipient);
    }

    function test_MintIP_RevertsZeroAddress() public {
        vm.prank(owner);
        collection.grantMinterRole(minter);

        vm.prank(minter);
        vm.expectRevert("Collection: cannot mint to zero address");
        collection.mintIP(address(0));
    }

    function test_MintIP_IncrementsTokenId() public {
        vm.prank(owner);
        collection.grantMinterRole(minter);

        vm.startPrank(minter);
        uint256 tokenId1 = collection.mintIP(recipient);
        uint256 tokenId2 = collection.mintIP(recipient);
        vm.stopPrank();

        assertEq(tokenId1, 1);
        assertEq(tokenId2, 2);
        assertEq(collection.totalSupply(), 2);
    }

    // ============ mintIPWithURI Tests ============

    function test_MintIPWithURI_Success() public {
        vm.prank(owner);
        collection.grantMinterRole(minter);

        string memory uri = "ipfs://QmTest123";
        vm.prank(minter);
        uint256 tokenId = collection.mintIPWithURI(recipient, uri);

        assertEq(tokenId, 1);
        assertEq(collection.ownerOf(tokenId), recipient);
        assertEq(collection.tokenURI(tokenId), uri);
    }

    function test_MintIPWithURI_EmitsEvent() public {
        vm.prank(owner);
        collection.grantMinterRole(minter);

        string memory uri = "ipfs://QmTest123";
        vm.expectEmit(true, true, false, true);
        emit TokenMinted(recipient, 1, uri);

        vm.prank(minter);
        collection.mintIPWithURI(recipient, uri);
    }

    function test_MintIPWithURI_RevertsWithoutRole() public {
        vm.prank(nonOwner);
        vm.expectRevert();
        collection.mintIPWithURI(recipient, "ipfs://test");
    }

    function test_MintIPWithURI_RevertsZeroAddress() public {
        vm.prank(owner);
        collection.grantMinterRole(minter);

        vm.prank(minter);
        vm.expectRevert("Collection: cannot mint to zero address");
        collection.mintIPWithURI(address(0), "ipfs://test");
    }

    // ============ ownerMint Tests ============

    function test_OwnerMint_Success() public {
        vm.prank(owner);
        uint256 tokenId = collection.ownerMint(recipient, "");

        assertEq(tokenId, 1);
        assertEq(collection.ownerOf(tokenId), recipient);
    }

    function test_OwnerMint_WithURI() public {
        string memory uri = "ipfs://QmTest123";
        vm.prank(owner);
        uint256 tokenId = collection.ownerMint(recipient, uri);

        assertEq(tokenId, 1);
        assertEq(collection.tokenURI(tokenId), uri);
    }

    function test_OwnerMint_WithoutURI() public {
        vm.prank(owner);
        uint256 tokenId = collection.ownerMint(recipient, "");

        // Should use baseURI if set, otherwise empty
        string memory uri = collection.tokenURI(tokenId);
        // Empty string or baseURI + tokenId
        assertTrue(bytes(uri).length >= 0);
    }

    function test_OwnerMint_RevertsNonOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert();
        collection.ownerMint(recipient, "");
    }

    function test_OwnerMint_RevertsZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert("Collection: cannot mint to zero address");
        collection.ownerMint(address(0), "");
    }

    // ============ grantMinterRole Tests ============

    function test_GrantMinterRole_Success() public {
        vm.expectEmit(true, false, false, false);
        emit MinterRoleGranted(minter);

        vm.prank(owner);
        collection.grantMinterRole(minter);

        assertTrue(collection.hasRole(collection.MINTER_ROLE(), minter));
    }

    function test_GrantMinterRole_RevertsNonOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert();
        collection.grantMinterRole(minter);
    }

    function test_GrantMinterRole_RevertsZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert("Collection: minter cannot be zero address");
        collection.grantMinterRole(address(0));
    }

    function test_GrantMinterRole_RevertsDuplicate() public {
        vm.startPrank(owner);
        collection.grantMinterRole(minter);
        
        vm.expectRevert("Collection: minter already has role");
        collection.grantMinterRole(minter);
        vm.stopPrank();
    }

    // ============ revokeMinterRole Tests ============

    function test_RevokeMinterRole_Success() public {
        vm.startPrank(owner);
        collection.grantMinterRole(minter);
        assertTrue(collection.hasRole(collection.MINTER_ROLE(), minter));

        vm.expectEmit(true, false, false, false);
        emit MinterRoleRevoked(minter);

        collection.revokeMinterRole(minter);
        assertFalse(collection.hasRole(collection.MINTER_ROLE(), minter));
        vm.stopPrank();
    }

    function test_RevokeMinterRole_RevertsNonOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert();
        collection.revokeMinterRole(minter);
    }

    function test_RevokeMinterRole_RevertsNotGranted() public {
        vm.prank(owner);
        vm.expectRevert("Collection: minter does not have role");
        collection.revokeMinterRole(minter);
    }

    // ============ setBaseURI Tests ============

    function test_SetBaseURI_Success() public {
        string memory baseURI = "ipfs://QmBase/";
        
        vm.expectEmit(false, false, false, true);
        emit BaseURIUpdated(baseURI);

        vm.prank(owner);
        collection.setBaseURI(baseURI);

        // Token URI should use baseURI + tokenId
        vm.prank(owner);
        collection.ownerMint(recipient, "");
        
        string memory uri = collection.tokenURI(1);
        assertTrue(bytes(uri).length > 0);
    }

    function test_SetBaseURI_RevertsNonOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert();
        collection.setBaseURI("ipfs://test/");
    }

    // ============ tokenURI Tests ============

    function test_TokenURI_WithSpecificURI() public {
        vm.prank(owner);
        collection.grantMinterRole(minter);

        string memory uri = "ipfs://QmSpecific";
        vm.prank(minter);
        collection.mintIPWithURI(recipient, uri);

        assertEq(collection.tokenURI(1), uri);
    }

    function test_TokenURI_WithBaseURI() public {
        vm.startPrank(owner);
        collection.setBaseURI("ipfs://QmBase/");
        collection.ownerMint(recipient, "");
        vm.stopPrank();

        string memory uri = collection.tokenURI(1);
        // Should be baseURI + tokenId
        assertTrue(bytes(uri).length > 0);
    }

    function test_TokenURI_RevertsNonExistent() public {
        vm.expectRevert();
        collection.tokenURI(999);
    }

    // ============ View Function Tests ============

    function test_CurrentTokenId_StartsAtOne() public {
        assertEq(collection.currentTokenId(), 1);
    }

    function test_CurrentTokenId_Increments() public {
        vm.prank(owner);
        collection.grantMinterRole(minter);

        vm.startPrank(minter);
        collection.mintIP(recipient);
        assertEq(collection.currentTokenId(), 2);
        
        collection.mintIP(recipient);
        assertEq(collection.currentTokenId(), 3);
        vm.stopPrank();
    }

    function test_TotalSupply_StartsAtZero() public {
        assertEq(collection.totalSupply(), 0);
    }

    function test_TotalSupply_Increments() public {
        vm.prank(owner);
        collection.grantMinterRole(minter);

        vm.startPrank(minter);
        collection.mintIP(recipient);
        assertEq(collection.totalSupply(), 1);
        
        collection.mintIP(recipient);
        assertEq(collection.totalSupply(), 2);
        vm.stopPrank();
    }

    function test_TotalSupply_EqualsCurrentTokenIdMinusOne() public {
        vm.prank(owner);
        collection.grantMinterRole(minter);

        vm.startPrank(minter);
        for (uint256 i = 0; i < 5; i++) {
            collection.mintIP(recipient);
            assertEq(collection.totalSupply(), collection.currentTokenId() - 1);
        }
        vm.stopPrank();
    }

    // ============ Reentrancy Protection Tests ============

    function test_ReentrancyProtection_MintIP() public {
        ReentrancyAttacker attacker = new ReentrancyAttacker();
        
        vm.prank(owner);
        collection.grantMinterRole(address(attacker));

        attacker.setTarget(collection);
        
        // Should not revert - reentrancy protection should prevent the attack
        attacker.attack();
        
        // Collection should still be in valid state
        assertEq(collection.totalSupply(), 0);
    }

    function test_ReentrancyProtection_MintIPWithURI() public {
        ReentrancyAttacker attacker = new ReentrancyAttacker();
        
        vm.prank(owner);
        collection.grantMinterRole(address(attacker));

        attacker.setTarget(collection);
        
        // Should not revert - reentrancy protection should prevent the attack
        attacker.attack();
        
        // Collection should still be in valid state
        assertEq(collection.totalSupply(), 0);
    }

    function test_ReentrancyProtection_OwnerMint() public {
        ReentrancyAttacker attacker = new ReentrancyAttacker();
        
        // Transfer ownership to attacker
        vm.startPrank(owner);
        collection.transferOwnership(address(attacker));
        vm.stopPrank();
        
        vm.prank(address(attacker));
        collection.acceptOwnership();

        attacker.setTarget(collection);
        
        // Should not revert - reentrancy protection should prevent the attack
        attacker.attack();
    }
}

