// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../CampaignStickers.sol";

/// @dev Minimal cheatcode interface (avoids broken npm forge-std / ds-test)
interface Vm {
    function prank(address) external;
    function addr(uint256) external returns (address);
    function sign(uint256, bytes32) external returns (uint8, bytes32, bytes32);
    function expectRevert(bytes4) external;
}

/**
 * @notice Foundry tests for CampaignStickers.
 * Run: forge test --match-contract CampaignStickersTest -vv
 */
contract CampaignStickersTest {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    CampaignStickers public stickers;

    address public brand;
    address public voter;
    address public other;
    uint256 public verifierPk = 0xA11CE;
    address public verifier;

    function setUp() public {
        brand = address(uint160(uint256(keccak256("brand"))));
        voter = address(uint160(uint256(keccak256("voter"))));
        other = address(uint160(uint256(keccak256("other"))));
        stickers = new CampaignStickers();
        verifier = vm.addr(verifierPk);
    }

    function _create() internal returns (uint256 tokenId) {
        vm.prank(brand);
        tokenId = stickers.createSticker("ipfs://QmTestMeta", "0xproposal1", verifier);
    }

    function _signClaim(uint256 tokenId, address claimer) internal returns (bytes memory) {
        bytes32 typeHash = stickers.CLAIM_TYPEHASH();
        bytes32 structHash = keccak256(abi.encode(typeHash, tokenId, claimer));
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("CampaignStickers")),
                keccak256(bytes("1")),
                block.chainid,
                address(stickers)
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(verifierPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function test_createSticker_permissionless() public {
        uint256 id = _create();
        require(id == 0, "id");
        (address admin, address v, string memory proposalId, bool exists) = stickers.stickers(id);
        require(admin == brand, "admin");
        require(v == verifier, "verifier");
        require(keccak256(bytes(proposalId)) == keccak256(bytes("0xproposal1")), "proposal");
        require(exists, "exists");
        require(keccak256(bytes(stickers.uri(id))) == keccak256(bytes("ipfs://QmTestMeta")), "uri");
        require(stickers.nextTokenId() == 1, "next");
    }

    function test_createSticker_revertsOnZeroVerifier() public {
        vm.prank(brand);
        vm.expectRevert(CampaignStickers.InvalidVerifier.selector);
        stickers.createSticker("ipfs://x", "p", address(0));
    }

    function test_createSticker_revertsOnEmptyURI() public {
        vm.prank(brand);
        vm.expectRevert(CampaignStickers.InvalidURI.selector);
        stickers.createSticker("", "p", verifier);
    }

    function test_claim_mintsOnce() public {
        uint256 id = _create();
        bytes memory sig = _signClaim(id, voter);

        vm.prank(voter);
        stickers.claim(id, sig);

        require(stickers.balanceOf(voter, id) == 1, "balance");
        require(stickers.hasClaimed(id, voter), "claimed");

        vm.prank(voter);
        vm.expectRevert(CampaignStickers.AlreadyClaimed.selector);
        stickers.claim(id, sig);
    }

    function test_claim_rejectsBadSignature() public {
        uint256 id = _create();
        bytes memory sig = _signClaim(id, other);

        vm.prank(voter);
        vm.expectRevert(CampaignStickers.InvalidSignature.selector);
        stickers.claim(id, sig);
    }

    function test_claim_rejectsUnknownToken() public {
        bytes memory sig = _signClaim(99, voter);
        vm.prank(voter);
        vm.expectRevert(CampaignStickers.StickerDoesNotExist.selector);
        stickers.claim(99, sig);
    }

    function test_setTokenURI_onlyAdmin() public {
        uint256 id = _create();
        vm.prank(other);
        vm.expectRevert(CampaignStickers.NotAdmin.selector);
        stickers.setTokenURI(id, "ipfs://new");

        vm.prank(brand);
        stickers.setTokenURI(id, "ipfs://new");
        require(keccak256(bytes(stickers.uri(id))) == keccak256(bytes("ipfs://new")), "uri");
    }
}
