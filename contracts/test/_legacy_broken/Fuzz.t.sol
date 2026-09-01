// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../CreatorIPFactory.sol";
import "../CreatorIPCollection.sol";
import "./helpers/TestHelpers.sol";

contract FuzzTest is Test {
    using TestHelpers for *;

    CreatorIPFactory public factory;
    address public owner;
    address public platformMinter;

    function setUp() public {
        owner = address(0x1);
        platformMinter = address(0x2);

        vm.startPrank(owner);
        factory = new CreatorIPFactory(owner, platformMinter);
        vm.stopPrank();
    }

    // ============ Fuzz Tests for Factory ============

    function testFuzz_DeployCreatorCollection(
        address creator,
        string memory name,
        string memory symbol
    ) public {
        // Skip zero address
        vm.assume(creator != address(0));
        // Skip if creator already has collection
        vm.assume(!factory.hasCollection(creator));

        vm.prank(owner);
        address collection = factory.deployCreatorCollection(name, symbol, creator);

        assertTrue(collection != address(0));
        assertEq(factory.getCreatorCollection(creator), collection);
        assertTrue(factory.hasCollection(creator));

        // Verify collection ownership
        CreatorIPCollection collectionContract = CreatorIPCollection(collection);
        assertEq(collectionContract.owner(), creator);
    }

    function testFuzz_BatchDeployCollections(
        uint8 count,
        address[] memory creators,
        string[] memory names,
        string[] memory symbols
    ) public {
        // Limit count to MAX_BATCH_SIZE
        count = uint8(bound(count, 1, factory.MAX_BATCH_SIZE()));
        
        // Ensure arrays match count
        creators = new address[](count);
        names = new string[](count);
        symbols = new string[](count);

        // Generate unique non-zero addresses
        for (uint256 i = 0; i < count; i++) {
            address creator = address(uint160(uint256(keccak256(abi.encodePacked(i, block.timestamp)))));
            vm.assume(creator != address(0));
            vm.assume(!factory.hasCollection(creator));
            
            creators[i] = creator;
            names[i] = string(abi.encodePacked("Collection ", i));
            symbols[i] = string(abi.encodePacked("COL", i));
        }

        vm.prank(owner);
        address[] memory collections = factory.batchDeployCollections(
            creators,
            names,
            symbols
        );

        assertEq(collections.length, count);
        // Verify all collections were deployed correctly
        for (uint256 i = 0; i < count; i++) {
            assertTrue(factory.hasCollection(creators[i]));
            assertEq(factory.getCreatorCollection(creators[i]), collections[i]);
        }
    }

    function testFuzz_SetPlatformMinter(address newMinter) public {
        vm.assume(newMinter != address(0));

        vm.prank(owner);
        factory.setPlatformMinter(newMinter);

        assertEq(factory.platformMinter(), newMinter);
    }

    // ============ Fuzz Tests for Collection ============

    function testFuzz_MintIP(address recipient, uint256 mintCount) public {
        vm.assume(recipient != address(0));
        mintCount = bound(mintCount, 1, 100); // Reasonable limit

        vm.prank(owner);
        address collectionAddress = factory.deployCreatorCollection(
            "Test Collection",
            "TEST",
            owner
        );
        CreatorIPCollection collection = CreatorIPCollection(collectionAddress);

        vm.prank(owner);
        collection.grantMinterRole(platformMinter);

        vm.startPrank(platformMinter);
        for (uint256 i = 0; i < mintCount; i++) {
            uint256 tokenId = collection.mintIP(recipient);
            assertEq(tokenId, i + 1);
            assertEq(collection.ownerOf(tokenId), recipient);
        }
        vm.stopPrank();

        assertEq(collection.totalSupply(), mintCount);
        assertEq(collection.currentTokenId(), mintCount + 1);
    }

    function testFuzz_MintIPWithURI(
        address recipient,
        string memory uri
    ) public {
        vm.assume(recipient != address(0));

        vm.prank(owner);
        address collectionAddress = factory.deployCreatorCollection(
            "Test Collection",
            "TEST",
            owner
        );
        CreatorIPCollection collection = CreatorIPCollection(collectionAddress);

        vm.prank(owner);
        collection.grantMinterRole(platformMinter);

        vm.prank(platformMinter);
        uint256 tokenId = collection.mintIPWithURI(recipient, uri);

        assertEq(tokenId, 1);
        assertEq(collection.ownerOf(tokenId), recipient);
        assertEq(collection.tokenURI(tokenId), uri);
    }

    function testFuzz_OwnerMint(
        address recipient,
        string memory uri
    ) public {
        vm.assume(recipient != address(0));

        vm.prank(owner);
        address collectionAddress = factory.deployCreatorCollection(
            "Test Collection",
            "TEST",
            owner
        );
        CreatorIPCollection collection = CreatorIPCollection(collectionAddress);

        vm.prank(owner);
        uint256 tokenId = collection.ownerMint(recipient, uri);

        assertEq(tokenId, 1);
        assertEq(collection.ownerOf(tokenId), recipient);
        
        if (bytes(uri).length > 0) {
            assertEq(collection.tokenURI(tokenId), uri);
        }
    }

    function testFuzz_GrantMinterRole(address minter) public {
        vm.assume(minter != address(0));
        vm.assume(minter != owner);

        vm.prank(owner);
        address collectionAddress = factory.deployCreatorCollection(
            "Test Collection",
            "TEST",
            owner
        );
        CreatorIPCollection collection = CreatorIPCollection(collectionAddress);

        vm.prank(owner);
        collection.grantMinterRole(minter);

        assertTrue(collection.hasRole(collection.MINTER_ROLE(), minter));
    }

    function testFuzz_SetBaseURI(string memory baseURI) public {
        vm.prank(owner);
        address collectionAddress = factory.deployCreatorCollection(
            "Test Collection",
            "TEST",
            owner
        );
        CreatorIPCollection collection = CreatorIPCollection(collectionAddress);

        vm.prank(owner);
        collection.setBaseURI(baseURI);

        // Mint a token and check URI
        vm.prank(owner);
        collection.ownerMint(owner, "");

        string memory uri = collection.tokenURI(1);
        // URI should be non-empty if baseURI is set
        if (bytes(baseURI).length > 0) {
            assertTrue(bytes(uri).length > 0);
        }
    }

    function testFuzz_TokenURI_WithBaseURIAndSpecificURI(
        string memory baseURI,
        string memory specificURI
    ) public {
        vm.prank(owner);
        address collectionAddress = factory.deployCreatorCollection(
            "Test Collection",
            "TEST",
            owner
        );
        CreatorIPCollection collection = CreatorIPCollection(collectionAddress);

        vm.startPrank(owner);
        collection.setBaseURI(baseURI);
        
        // Mint with specific URI
        collection.ownerMint(owner, specificURI);
        vm.stopPrank();

        // If specific URI is provided, it should be used
        if (bytes(specificURI).length > 0) {
            assertEq(collection.tokenURI(1), specificURI);
        } else if (bytes(baseURI).length > 0) {
            // Otherwise, baseURI + tokenId should be used
            string memory uri = collection.tokenURI(1);
            assertTrue(bytes(uri).length > 0);
        }
    }

    // ============ Edge Cases ============

    function testFuzz_EmptyStrings(string memory name, string memory symbol) public {
        // Empty strings are allowed (though not recommended)
        address creator = address(0x10);

        vm.prank(owner);
        address collection = factory.deployCreatorCollection(name, symbol, creator);

        assertTrue(collection != address(0));
    }

    function testFuzz_VeryLongStrings(
        string memory name,
        string memory symbol
    ) public {
        // Bound string length to prevent out-of-gas
        vm.assume(bytes(name).length < 1000);
        vm.assume(bytes(symbol).length < 1000);

        address creator = address(0x10);

        vm.prank(owner);
        address collection = factory.deployCreatorCollection(name, symbol, creator);

        assertTrue(collection != address(0));
    }

    function testFuzz_UnicodeStrings(string memory name) public {
        // Unicode strings should work
        address creator = address(0x10);
        string memory symbol = "TEST";

        vm.prank(owner);
        address collection = factory.deployCreatorCollection(name, symbol, creator);

        assertTrue(collection != address(0));
    }

    function testFuzz_MultipleGrantsAndRevokes(address minter) public {
        vm.assume(minter != address(0));
        vm.assume(minter != owner);

        vm.prank(owner);
        address collectionAddress = factory.deployCreatorCollection(
            "Test Collection",
            "TEST",
            owner
        );
        CreatorIPCollection collection = CreatorIPCollection(collectionAddress);

        // Grant, revoke, grant again
        vm.startPrank(owner);
        collection.grantMinterRole(minter);
        assertTrue(collection.hasRole(collection.MINTER_ROLE(), minter));

        collection.revokeMinterRole(minter);
        assertFalse(collection.hasRole(collection.MINTER_ROLE(), minter));

        collection.grantMinterRole(minter);
        assertTrue(collection.hasRole(collection.MINTER_ROLE(), minter));
        vm.stopPrank();
    }
}

