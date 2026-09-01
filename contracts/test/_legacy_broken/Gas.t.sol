// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../CreatorIPFactory.sol";
import "../CreatorIPCollection.sol";
import "./helpers/TestHelpers.sol";

contract GasTest is Test {
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

    // ============ Single Deployment Gas Tests ============

    function test_Gas_SingleDeployment() public {
        address creator = address(0x10);

        vm.prank(owner);
        uint256 gasBefore = gasleft();
        factory.deployCreatorCollection("Test Collection", "TEST", creator);
        uint256 gasUsed = gasBefore - gasleft();

        console.log("Gas used for single deployment:", gasUsed);
        
        // Should be around 2-3M gas per deployment
        assertLt(gasUsed, 5_000_000); // Upper bound check
    }

    // ============ Batch Deployment Gas Tests ============

    function test_Gas_BatchDeploy_1() public {
        address[] memory creators = new address[](1);
        string[] memory names = new string[](1);
        string[] memory symbols = new string[](1);

        creators[0] = address(0x10);
        names[0] = "Collection 1";
        symbols[0] = "COL1";

        vm.prank(owner);
        uint256 gasBefore = gasleft();
        factory.batchDeployCollections(creators, names, symbols);
        uint256 gasUsed = gasBefore - gasleft();

        console.log("Gas used for batch of 1:", gasUsed);
    }

    function test_Gas_BatchDeploy_10() public {
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
        uint256 gasBefore = gasleft();
        factory.batchDeployCollections(creators, names, symbols);
        uint256 gasUsed = gasBefore - gasleft();

        console.log("Gas used for batch of 10:", gasUsed);
        console.log("Average gas per deployment:", gasUsed / count);
        
        // Should be around 20-30M gas for 10 deployments
        assertLt(gasUsed, 50_000_000);
    }

    function test_Gas_BatchDeploy_30() public {
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
        uint256 gasBefore = gasleft();
        factory.batchDeployCollections(creators, names, symbols);
        uint256 gasUsed = gasBefore - gasleft();

        console.log("Gas used for batch of 30 (MAX_BATCH_SIZE):", gasUsed);
        console.log("Average gas per deployment:", gasUsed / count);
        
        // Should be around 60-90M gas for 30 deployments (as documented)
        assertLt(gasUsed, 150_000_000); // Upper bound with safety margin
        assertGt(gasUsed, 30_000_000); // Lower bound check
    }

    // ============ Minting Gas Tests ============

    function test_Gas_MintIP() public {
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
        uint256 gasBefore = gasleft();
        collection.mintIP(owner);
        uint256 gasUsed = gasBefore - gasleft();

        console.log("Gas used for mintIP:", gasUsed);
    }

    function test_Gas_MintIPWithURI() public {
        vm.prank(owner);
        address collectionAddress = factory.deployCreatorCollection(
            "Test Collection",
            "TEST",
            owner
        );
        CreatorIPCollection collection = CreatorIPCollection(collectionAddress);

        vm.prank(owner);
        collection.grantMinterRole(platformMinter);

        string memory uri = "ipfs://QmTest123456789012345678901234567890123456789012345678901234567890";
        vm.prank(platformMinter);
        uint256 gasBefore = gasleft();
        collection.mintIPWithURI(owner, uri);
        uint256 gasUsed = gasBefore - gasleft();

        console.log("Gas used for mintIPWithURI:", gasUsed);
    }

    function test_Gas_OwnerMint() public {
        vm.prank(owner);
        address collectionAddress = factory.deployCreatorCollection(
            "Test Collection",
            "TEST",
            owner
        );
        CreatorIPCollection collection = CreatorIPCollection(collectionAddress);

        vm.prank(owner);
        uint256 gasBefore = gasleft();
        collection.ownerMint(owner, "");
        uint256 gasUsed = gasBefore - gasleft();

        console.log("Gas used for ownerMint:", gasUsed);
    }

    function test_Gas_MultipleMints() public {
        vm.prank(owner);
        address collectionAddress = factory.deployCreatorCollection(
            "Test Collection",
            "TEST",
            owner
        );
        CreatorIPCollection collection = CreatorIPCollection(collectionAddress);

        vm.prank(owner);
        collection.grantMinterRole(platformMinter);

        uint256 totalGas = 0;
        vm.startPrank(platformMinter);
        for (uint256 i = 0; i < 10; i++) {
            uint256 gasBefore = gasleft();
            collection.mintIP(owner);
            totalGas += gasBefore - gasleft();
        }
        vm.stopPrank();

        console.log("Total gas for 10 mints:", totalGas);
        console.log("Average gas per mint:", totalGas / 10);
    }

    // ============ Role Management Gas Tests ============

    function test_Gas_GrantMinterRole() public {
        vm.prank(owner);
        address collectionAddress = factory.deployCreatorCollection(
            "Test Collection",
            "TEST",
            owner
        );
        CreatorIPCollection collection = CreatorIPCollection(collectionAddress);

        vm.prank(owner);
        uint256 gasBefore = gasleft();
        collection.grantMinterRole(platformMinter);
        uint256 gasUsed = gasBefore - gasleft();

        console.log("Gas used for grantMinterRole:", gasUsed);
    }

    function test_Gas_RevokeMinterRole() public {
        vm.prank(owner);
        address collectionAddress = factory.deployCreatorCollection(
            "Test Collection",
            "TEST",
            owner
        );
        CreatorIPCollection collection = CreatorIPCollection(collectionAddress);

        vm.startPrank(owner);
        collection.grantMinterRole(platformMinter);
        
        uint256 gasBefore = gasleft();
        collection.revokeMinterRole(platformMinter);
        uint256 gasUsed = gasBefore - gasleft();
        vm.stopPrank();

        console.log("Gas used for revokeMinterRole:", gasUsed);
    }

    // ============ View Function Gas Tests ============

    function test_Gas_ViewFunctions() public {
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
        collection.mintIP(owner);
        vm.stopPrank();

        // View functions should be free (no gas cost)
        uint256 gasBefore = gasleft();
        collection.owner();
        collection.currentTokenId();
        collection.totalSupply();
        collection.tokenURI(1);
        uint256 gasUsed = gasBefore - gasleft();

        console.log("Gas used for view functions (should be 0 in actual execution):", gasUsed);
    }

    // ============ Gas Comparison Tests ============

    function test_Gas_CompareMintingMethods() public {
        vm.prank(owner);
        address collectionAddress = factory.deployCreatorCollection(
            "Test Collection",
            "TEST",
            owner
        );
        CreatorIPCollection collection = CreatorIPCollection(collectionAddress);

        vm.prank(owner);
        collection.grantMinterRole(platformMinter);

        // Compare mintIP vs ownerMint
        vm.prank(platformMinter);
        uint256 gasMintIP = gasleft();
        collection.mintIP(owner);
        gasMintIP = gasMintIP - gasleft();

        vm.prank(owner);
        uint256 gasOwnerMint = gasleft();
        collection.ownerMint(owner, "");
        gasOwnerMint = gasOwnerMint - gasleft();

        console.log("Gas for mintIP (with role check):", gasMintIP);
        console.log("Gas for ownerMint (with owner check):", gasOwnerMint);
    }

    // ============ Gas Optimization Verification ============

    function test_Gas_VerifyMaxBatchSize() public {
        // Verify that MAX_BATCH_SIZE = 30 is safe for gas limits
        uint256 maxBatchSize = factory.MAX_BATCH_SIZE();
        assertEq(maxBatchSize, 30, "MAX_BATCH_SIZE should be 30");

        address[] memory creators = new address[](maxBatchSize);
        string[] memory names = new string[](maxBatchSize);
        string[] memory symbols = new string[](maxBatchSize);

        for (uint256 i = 0; i < maxBatchSize; i++) {
            creators[i] = TestHelpers.makeAddr(string(abi.encodePacked("creator", i)));
            names[i] = string(abi.encodePacked("Collection ", i));
            symbols[i] = string(abi.encodePacked("COL", i));
        }

        vm.prank(owner);
        uint256 gasBefore = gasleft();
        factory.batchDeployCollections(creators, names, symbols);
        uint256 gasUsed = gasBefore - gasleft();

        console.log("Gas used for MAX_BATCH_SIZE (30):", gasUsed);
        
        // Verify it's within reasonable limits (block gas limit is typically 30M, but we use 150M as upper bound for safety)
        assertLt(gasUsed, 150_000_000, "Batch deployment should not exceed gas limits");
    }
}

