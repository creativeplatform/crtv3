// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../CreatorIPFactory.sol";
import "../CreatorIPCollection.sol";
import "./helpers/TestHelpers.sol";

contract IntegrationTest is Test {
    using TestHelpers for *;

    CreatorIPFactory public factory;
    address public owner;
    address public platformMinter;
    address public creator1;
    address public creator2;
    address public creator3;

    function setUp() public {
        owner = address(0x1);
        platformMinter = address(0x2);
        creator1 = address(0x3);
        creator2 = address(0x4);
        creator3 = address(0x5);

        vm.startPrank(owner);
        factory = new CreatorIPFactory(owner, platformMinter);
        vm.stopPrank();
    }

    // ============ Factory Deploys Collection → Creator Owns It ============

    function test_FactoryDeploys_CreatorOwns() public {
        // Compute address before deployment (CREATE2)
        address predictedAddress = factory.computeCollectionAddress(
            creator1,
            "Creator1 Collection",
            "C1"
        );

        vm.prank(owner);
        address collectionAddress = factory.deployCreatorCollection(
            "Creator1 Collection",
            "C1",
            creator1
        );

        // Verify CREATE2 address matches
        assertEq(collectionAddress, predictedAddress);

        CreatorIPCollection collection = CreatorIPCollection(collectionAddress);
        
        // Creator should own the collection
        assertEq(collection.owner(), creator1);
        
        // Creator should have DEFAULT_ADMIN_ROLE
        assertTrue(collection.hasRole(collection.DEFAULT_ADMIN_ROLE(), creator1));
    }

    // ============ Factory Deploys → Creator Grants MINTER_ROLE → Platform Mints ============

    function test_FullFlow_DeployGrantMint() public {
        // 1. Factory deploys collection
        vm.prank(owner);
        address collectionAddress = factory.deployCreatorCollection(
            "Creator1 Collection",
            "C1",
            creator1
        );
        CreatorIPCollection collection = CreatorIPCollection(collectionAddress);

        // 2. Creator grants MINTER_ROLE to platform
        vm.prank(creator1);
        collection.grantMinterRole(platformMinter);
        assertTrue(collection.hasRole(collection.MINTER_ROLE(), platformMinter));

        // 3. Platform mints NFT for creator
        vm.prank(platformMinter);
        uint256 tokenId = collection.mintIP(creator1);

        // 4. Verify NFT ownership
        assertEq(collection.ownerOf(tokenId), creator1);
        assertEq(collection.totalSupply(), 1);
    }

    function test_FullFlow_DeployGrantMintWithURI() public {
        vm.prank(owner);
        address collectionAddress = factory.deployCreatorCollection(
            "Creator1 Collection",
            "C1",
            creator1
        );
        CreatorIPCollection collection = CreatorIPCollection(collectionAddress);

        vm.prank(creator1);
        collection.grantMinterRole(platformMinter);

        string memory uri = "ipfs://QmTest123";
        vm.prank(platformMinter);
        uint256 tokenId = collection.mintIPWithURI(creator1, uri);

        assertEq(collection.ownerOf(tokenId), creator1);
        assertEq(collection.tokenURI(tokenId), uri);
    }

    function test_FullFlow_CreatorCanRevokeMinterRole() public {
        vm.prank(owner);
        address collectionAddress = factory.deployCreatorCollection(
            "Creator1 Collection",
            "C1",
            creator1
        );
        CreatorIPCollection collection = CreatorIPCollection(collectionAddress);

        // Grant role
        vm.prank(creator1);
        collection.grantMinterRole(platformMinter);
        assertTrue(collection.hasRole(collection.MINTER_ROLE(), platformMinter));

        // Mint one token
        vm.prank(platformMinter);
        collection.mintIP(creator1);

        // Revoke role
        vm.prank(creator1);
        collection.revokeMinterRole(platformMinter);
        assertFalse(collection.hasRole(collection.MINTER_ROLE(), platformMinter));

        // Platform should no longer be able to mint
        vm.prank(platformMinter);
        vm.expectRevert();
        collection.mintIP(creator1);
    }

    // ============ Batch Deployment → Multiple Creators Own Their Collections ============

    function test_BatchDeploy_MultipleCreatorsOwn() public {
        address[] memory creators = new address[](3);
        string[] memory names = new string[](3);
        string[] memory symbols = new string[](3);

        creators[0] = creator1;
        creators[1] = creator2;
        creators[2] = creator3;
        names[0] = "Collection 1";
        names[1] = "Collection 2";
        names[2] = "Collection 3";
        symbols[0] = "COL1";
        symbols[1] = "COL2";
        symbols[2] = "COL3";

        vm.prank(owner);
        address[] memory collections = factory.batchDeployCollections(
            creators,
            names,
            symbols
        );

        // Verify each creator owns their collection
        assertEq(CreatorIPCollection(collections[0]).owner(), creator1);
        assertEq(CreatorIPCollection(collections[1]).owner(), creator2);
        assertEq(CreatorIPCollection(collections[2]).owner(), creator3);
    }

    function test_BatchDeploy_EachCreatorCanMint() public {
        address[] memory creators = new address[](2);
        string[] memory names = new string[](2);
        string[] memory symbols = new string[](2);

        creators[0] = creator1;
        creators[1] = creator2;
        names[0] = "Collection 1";
        names[1] = "Collection 2";
        symbols[0] = "COL1";
        symbols[1] = "COL2";

        vm.prank(owner);
        address[] memory collections = factory.batchDeployCollections(
            creators,
            names,
            symbols
        );

        CreatorIPCollection collection1 = CreatorIPCollection(collections[0]);
        CreatorIPCollection collection2 = CreatorIPCollection(collections[1]);

        // Creator1 mints in their collection
        vm.prank(creator1);
        collection1.ownerMint(creator1, "");

        // Creator2 mints in their collection
        vm.prank(creator2);
        collection2.ownerMint(creator2, "");

        assertEq(collection1.totalSupply(), 1);
        assertEq(collection2.totalSupply(), 1);
    }

    // ============ Owner Transfer Flow (Ownable2Step) ============

    function test_Ownable2Step_TransferOwnership() public {
        vm.prank(owner);
        address collectionAddress = factory.deployCreatorCollection(
            "Test Collection",
            "TEST",
            creator1
        );
        CreatorIPCollection collection = CreatorIPCollection(collectionAddress);

        address newOwner = address(0x10);

        // Step 1: Creator initiates transfer
        vm.prank(creator1);
        collection.transferOwnership(newOwner);

        // Ownership should not have changed yet
        assertEq(collection.owner(), creator1);
        assertEq(collection.pendingOwner(), newOwner);

        // Step 2: New owner accepts
        vm.prank(newOwner);
        collection.acceptOwnership();

        // Ownership should now be transferred
        assertEq(collection.owner(), newOwner);
    }

    function test_Ownable2Step_OnlyPendingOwnerCanAccept() public {
        vm.prank(owner);
        address collectionAddress = factory.deployCreatorCollection(
            "Test Collection",
            "TEST",
            creator1
        );
        CreatorIPCollection collection = CreatorIPCollection(collectionAddress);

        address newOwner = address(0x10);
        address wrongOwner = address(0x11);

        vm.prank(creator1);
        collection.transferOwnership(newOwner);

        // Wrong owner cannot accept
        vm.prank(wrongOwner);
        vm.expectRevert();
        collection.acceptOwnership();

        // Original owner should still be owner
        assertEq(collection.owner(), creator1);
    }

    // ============ Collection Enumeration via Factory ============

    // Note: totalCollections() and getCollectionByIndex() removed for contract size optimization
    // Use CollectionCreated events and hasCollection() for enumeration

    function test_Enumeration_HasCollection() public {
        vm.prank(owner);
        factory.deployCreatorCollection("Test", "T", creator1);

        assertTrue(factory.hasCollection(creator1));
        assertFalse(factory.hasCollection(creator2));
    }

    // ============ Complex Scenarios ============

    function test_Complex_MultipleMintsAfterGrant() public {
        vm.prank(owner);
        address collectionAddress = factory.deployCreatorCollection(
            "Test Collection",
            "TEST",
            creator1
        );
        CreatorIPCollection collection = CreatorIPCollection(collectionAddress);

        vm.prank(creator1);
        collection.grantMinterRole(platformMinter);

        // Platform mints multiple NFTs
        vm.startPrank(platformMinter);
        for (uint256 i = 0; i < 5; i++) {
            collection.mintIP(creator1);
        }
        vm.stopPrank();

        assertEq(collection.totalSupply(), 5);
        assertEq(collection.currentTokenId(), 6);
    }

    function test_Complex_CreatorMintsDirectlyWithoutGrantingRole() public {
        vm.prank(owner);
        address collectionAddress = factory.deployCreatorCollection(
            "Test Collection",
            "TEST",
            creator1
        );
        CreatorIPCollection collection = CreatorIPCollection(collectionAddress);

        // Creator can mint directly without granting MINTER_ROLE
        vm.prank(creator1);
        collection.ownerMint(creator1, "ipfs://QmTest");

        assertEq(collection.totalSupply(), 1);
        assertEq(collection.tokenURI(1), "ipfs://QmTest");
    }

    function test_Complex_BaseURIAndTokenURI() public {
        vm.prank(owner);
        address collectionAddress = factory.deployCreatorCollection(
            "Test Collection",
            "TEST",
            creator1
        );
        CreatorIPCollection collection = CreatorIPCollection(collectionAddress);

        vm.startPrank(creator1);
        collection.setBaseURI("ipfs://QmBase/");
        collection.ownerMint(creator1, ""); // Mint without specific URI
        collection.ownerMint(creator1, "ipfs://QmSpecific"); // Mint with specific URI
        vm.stopPrank();

        // Token 1 should use baseURI + tokenId
        string memory uri1 = collection.tokenURI(1);
        assertTrue(bytes(uri1).length > 0);

        // Token 2 should use specific URI
        assertEq(collection.tokenURI(2), "ipfs://QmSpecific");
    }
}

