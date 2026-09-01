// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../CreatorIPFactory.sol";
import "../CreatorIPCollection.sol";
import "./helpers/TestHelpers.sol";

contract CreatorIPFactoryTest is Test {
    using TestHelpers for *;

    CreatorIPFactory public factory;
    address public owner;
    address public platformMinter;
    address public creator1;
    address public creator2;
    address public nonOwner;

    event CollectionCreated(
        address indexed creator,
        address indexed collectionAddress,
        string name,
        string symbol
    );
    event PlatformMinterUpdated(
        address indexed oldMinter,
        address indexed newMinter
    );

    function setUp() public {
        owner = address(0x1);
        platformMinter = address(0x2);
        creator1 = address(0x3);
        creator2 = address(0x4);
        nonOwner = address(0x5);

        vm.startPrank(owner);
        factory = new CreatorIPFactory(owner, platformMinter);
        vm.stopPrank();
    }

    // ============ Constructor Tests ============

    function test_Constructor_SetsOwner() public {
        assertEq(factory.owner(), owner);
    }

    function test_Constructor_SetsPlatformMinter() public {
        assertEq(factory.platformMinter(), platformMinter);
    }

    function test_Constructor_AllowsSameOwnerAndMinter() public {
        address same = address(0x10);
        CreatorIPFactory newFactory = new CreatorIPFactory(same, same);
        assertEq(newFactory.owner(), same);
        assertEq(newFactory.platformMinter(), same);
    }

    function test_Constructor_RevertsZeroOwner() public {
        vm.expectRevert(CreatorIPFactory.OwnerZeroAddress.selector);
        new CreatorIPFactory(address(0), platformMinter);
    }

    function test_Constructor_RevertsZeroMinter() public {
        vm.expectRevert(CreatorIPFactory.MinterZeroAddress.selector);
        new CreatorIPFactory(owner, address(0));
    }

    // ============ deployCreatorCollection Tests ============

    function test_DeployCreatorCollection_Success() public {
        // Compute address before deployment (CREATE2)
        address predictedAddress = factory.computeCollectionAddress(
            creator1,
            "Test Collection",
            "TEST"
        );
        assertTrue(predictedAddress != address(0));

        vm.prank(owner);
        address collection = factory.deployCreatorCollection(
            "Test Collection",
            "TEST",
            creator1
        );

        // Verify CREATE2 address matches prediction
        assertEq(collection, predictedAddress, "CREATE2 address should match prediction");
        assertTrue(collection != address(0));
        assertEq(factory.getCreatorCollection(creator1), collection);
        assertTrue(factory.hasCollection(creator1));

        // Verify collection ownership
        CreatorIPCollection collectionContract = CreatorIPCollection(collection);
        assertEq(collectionContract.owner(), creator1);
    }

    function test_DeployCreatorCollection_EmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit CollectionCreated(creator1, address(0), "Test Collection", "TEST");

        vm.prank(owner);
        factory.deployCreatorCollection("Test Collection", "TEST", creator1);
    }

    function test_DeployCreatorCollection_RevertsNonOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert();
        factory.deployCreatorCollection("Test", "T", creator1);
    }

    function test_DeployCreatorCollection_RevertsZeroCreator() public {
        vm.prank(owner);
        vm.expectRevert(CreatorIPFactory.CreatorZeroAddress.selector);
        factory.deployCreatorCollection("Test", "T", address(0));
    }

    function test_DeployCreatorCollection_RevertsDuplicate() public {
        vm.startPrank(owner);
        factory.deployCreatorCollection("Test", "T", creator1);
        
        vm.expectRevert(CreatorIPFactory.CreatorHasCollection.selector);
        factory.deployCreatorCollection("Test2", "T2", creator1);
        vm.stopPrank();
    }

    function test_DeployCreatorCollection_PreventsFrontRunning() public {
        vm.startPrank(owner);
        factory.deployCreatorCollection("Test", "T", creator1);
        
        // Try to deploy again in same block (front-running simulation)
        vm.expectRevert("Factory: creator already has collection");
        factory.deployCreatorCollection("Test2", "T2", creator1);
        vm.stopPrank();
    }

    // ============ batchDeployCollections Tests ============

    function test_BatchDeploy_Single() public {
        address[] memory creators = new address[](1);
        string[] memory names = new string[](1);
        string[] memory symbols = new string[](1);
        
        creators[0] = creator1;
        names[0] = "Collection 1";
        symbols[0] = "COL1";

        vm.prank(owner);
        address[] memory collections = factory.batchDeployCollections(
            creators,
            names,
            symbols
        );

        assertEq(collections.length, 1);
        assertTrue(collections[0] != address(0));
        assertTrue(factory.hasCollection(creator1));
    }

    function test_BatchDeploy_Multiple() public {
        uint256 count = 10;
        address[] memory creators = new address[](count);
        string[] memory names = new string[](count);
        string[] memory symbols = new string[](count);

        for (uint256 i = 0; i < count; i++) {
            creators[i] = TestHelpers.makeAddr(string(abi.encodePacked("creator", i)));
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
        // Verify all collections were deployed
        for (uint256 i = 0; i < count; i++) {
            assertTrue(factory.hasCollection(creators[i]));
        }
    }

    function test_BatchDeploy_MaxSize() public {
        uint256 count = factory.MAX_BATCH_SIZE();
        address[] memory creators = new address[](count);
        string[] memory names = new string[](count);
        string[] memory symbols = new string[](count);

        for (uint256 i = 0; i < count; i++) {
            creators[i] = TestHelpers.makeAddr(string(abi.encodePacked("creator", i)));
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
    }

    function test_BatchDeploy_RevertsArrayLengthMismatch() public {
        address[] memory creators = new address[](2);
        string[] memory names = new string[](1);
        string[] memory symbols = new string[](2);

        creators[0] = creator1;
        creators[1] = creator2;
        names[0] = "Test";
        symbols[0] = "T";
        symbols[1] = "T2";

        vm.prank(owner);
        vm.expectRevert(CreatorIPFactory.ArrayLengthMismatch.selector);
        factory.batchDeployCollections(creators, names, symbols);
    }

    function test_BatchDeploy_RevertsEmptyArrays() public {
        address[] memory creators = new address[](0);
        string[] memory names = new string[](0);
        string[] memory symbols = new string[](0);

        vm.prank(owner);
        vm.expectRevert(CreatorIPFactory.EmptyArrays.selector);
        factory.batchDeployCollections(creators, names, symbols);
    }

    function test_BatchDeploy_RevertsExceedsMaxSize() public {
        uint256 count = factory.MAX_BATCH_SIZE() + 1;
        address[] memory creators = new address[](count);
        string[] memory names = new string[](count);
        string[] memory symbols = new string[](count);

        for (uint256 i = 0; i < count; i++) {
            creators[i] = TestHelpers.makeAddr(string(abi.encodePacked("creator", i)));
            names[i] = "Test";
            symbols[i] = "T";
        }

        vm.prank(owner);
        vm.expectRevert(CreatorIPFactory.BatchSizeExceedsMaximum.selector);
        factory.batchDeployCollections(creators, names, symbols);
    }

    function test_BatchDeploy_RevertsZeroCreator() public {
        address[] memory creators = new address[](2);
        string[] memory names = new string[](2);
        string[] memory symbols = new string[](2);

        creators[0] = creator1;
        creators[1] = address(0);
        names[0] = "Test1";
        names[1] = "Test2";
        symbols[0] = "T1";
        symbols[1] = "T2";

        vm.prank(owner);
        vm.expectRevert(CreatorIPFactory.CreatorZeroAddress.selector);
        factory.batchDeployCollections(creators, names, symbols);
    }

    function test_BatchDeploy_RevertsDuplicateCreator() public {
        address[] memory creators = new address[](2);
        string[] memory names = new string[](2);
        string[] memory symbols = new string[](2);

        creators[0] = creator1;
        creators[1] = creator1; // Duplicate
        names[0] = "Test1";
        names[1] = "Test2";
        symbols[0] = "T1";
        symbols[1] = "T2";

        vm.prank(owner);
        vm.expectRevert(CreatorIPFactory.CreatorHasCollection.selector);
        factory.batchDeployCollections(creators, names, symbols);
    }

    // ============ setPlatformMinter Tests ============

    function test_SetPlatformMinter_Success() public {
        address newMinter = address(0x10);

        vm.expectEmit(true, true, false, false);
        emit PlatformMinterUpdated(platformMinter, newMinter);

        vm.prank(owner);
        factory.setPlatformMinter(newMinter);

        assertEq(factory.platformMinter(), newMinter);
    }

    function test_SetPlatformMinter_RevertsNonOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert();
        factory.setPlatformMinter(address(0x10));
    }

    function test_SetPlatformMinter_RevertsZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(CreatorIPFactory.MinterZeroAddress.selector);
        factory.setPlatformMinter(address(0));
    }

    // ============ View Function Tests ============

    function test_GetCreatorCollection_ReturnsZeroForNonExistent() public {
        address collection = factory.getCreatorCollection(creator1);
        assertEq(collection, address(0));
    }

    function test_GetCreatorCollection_ReturnsCollection() public {
        vm.prank(owner);
        address deployed = factory.deployCreatorCollection("Test", "T", creator1);
        
        address retrieved = factory.getCreatorCollection(creator1);
        assertEq(retrieved, deployed);
    }

    function test_HasCollection_ReturnsFalseForNonExistent() public {
        assertFalse(factory.hasCollection(creator1));
    }

    function test_HasCollection_ReturnsTrueForExistent() public {
        vm.prank(owner);
        factory.deployCreatorCollection("Test", "T", creator1);
        
        assertTrue(factory.hasCollection(creator1));
    }

    // Note: totalCollections() and getCollectionByIndex() removed for contract size optimization
    // Use CollectionCreated events for enumeration off-chain

    // ============ CREATE2 Tests ============

    function test_ComputeCollectionAddress_Deterministic() public {
        address predicted1 = factory.computeCollectionAddress(
            creator1,
            "Test Collection",
            "TEST"
        );
        address predicted2 = factory.computeCollectionAddress(
            creator1,
            "Test Collection",
            "TEST"
        );

        // Same inputs should produce same address
        assertEq(predicted1, predicted2);
        assertTrue(predicted1 != address(0));
    }

    function test_ComputeCollectionAddress_DifferentForDifferentCreators() public {
        address predicted1 = factory.computeCollectionAddress(
            creator1,
            "Test Collection",
            "TEST"
        );
        address predicted2 = factory.computeCollectionAddress(
            creator2,
            "Test Collection",
            "TEST"
        );

        // Different creators should produce different addresses
        assertTrue(predicted1 != predicted2);
    }

    function test_ComputeCollectionAddress_DifferentForDifferentNames() public {
        address predicted1 = factory.computeCollectionAddress(
            creator1,
            "Collection 1",
            "TEST"
        );
        address predicted2 = factory.computeCollectionAddress(
            creator1,
            "Collection 2",
            "TEST"
        );

        // Different names should produce different addresses
        assertTrue(predicted1 != predicted2);
    }

    function test_CREATE2_AddressMatchesPrediction() public {
        address predicted = factory.computeCollectionAddress(
            creator1,
            "Test Collection",
            "TEST"
        );

        vm.prank(owner);
        address deployed = factory.deployCreatorCollection(
            "Test Collection",
            "TEST",
            creator1
        );

        // Deployed address should match predicted address
        assertEq(deployed, predicted, "CREATE2 deployed address must match prediction");
    }

    function test_CREATE2_BatchDeployment() public {
        address[] memory creators = new address[](3);
        string[] memory names = new string[](3);
        string[] memory symbols = new string[](3);

        creators[0] = creator1;
        creators[1] = creator2;
        creators[2] = address(0x10);
        names[0] = "Collection 1";
        names[1] = "Collection 2";
        names[2] = "Collection 3";
        symbols[0] = "COL1";
        symbols[1] = "COL2";
        symbols[2] = "COL3";

        // Compute predicted addresses
        address[] memory predicted = new address[](3);
        for (uint256 i = 0; i < 3; i++) {
            predicted[i] = factory.computeCollectionAddress(
                creators[i],
                names[i],
                symbols[i]
            );
        }

        vm.prank(owner);
        address[] memory deployed = factory.batchDeployCollections(
            creators,
            names,
            symbols
        );

        // Verify all addresses match predictions
        for (uint256 i = 0; i < 3; i++) {
            assertEq(deployed[i], predicted[i], "Batch CREATE2 addresses must match predictions");
        }
    }
}

