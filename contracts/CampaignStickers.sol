// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155URIStorage.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title CampaignStickers
 * @notice Permissionless ERC-1155 stickers for Snapshot campaign voters on Base.
 *         Anyone can create a sticker; claims require an EIP-712 voucher signed
 *         by the sticker's verifier (platform wallet — signs only, never pays gas).
 */
contract CampaignStickers is ERC1155, ERC1155URIStorage, EIP712, ReentrancyGuard {
    using Counters for Counters.Counter;
    using ECDSA for bytes32;

    bytes32 public constant CLAIM_TYPEHASH =
        keccak256("Claim(uint256 tokenId,address claimer)");

    Counters.Counter private _tokenIdCounter;

    struct Sticker {
        address admin;
        address verifier;
        string proposalId;
        bool exists;
    }

    mapping(uint256 => Sticker) public stickers;
    /// @dev tokenId => claimer => already claimed
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    event StickerCreated(
        uint256 indexed tokenId,
        address indexed admin,
        address indexed verifier,
        string proposalId,
        string uri
    );
    event StickerClaimed(uint256 indexed tokenId, address indexed claimer);

    error InvalidVerifier();
    error InvalidURI();
    error StickerDoesNotExist();
    error AlreadyClaimed();
    error InvalidSignature();
    error NotAdmin();

    constructor() ERC1155("") EIP712("CampaignStickers", "1") {}

    /**
     * @notice Permissionlessly create a new campaign sticker.
     * @param tokenURI_ IPFS metadata URI (e.g. ipfs://Qm...)
     * @param proposalId Snapshot proposal ID this sticker is tied to
     * @param verifier Address authorized to sign claim vouchers (platform verifier)
     * @return tokenId Newly assigned token id
     */
    function createSticker(
        string calldata tokenURI_,
        string calldata proposalId,
        address verifier
    ) external returns (uint256 tokenId) {
        if (verifier == address(0)) revert InvalidVerifier();
        if (bytes(tokenURI_).length == 0) revert InvalidURI();

        tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        stickers[tokenId] = Sticker({
            admin: msg.sender,
            verifier: verifier,
            proposalId: proposalId,
            exists: true
        });

        _setURI(tokenId, tokenURI_);

        emit StickerCreated(tokenId, msg.sender, verifier, proposalId, tokenURI_);
    }

    /**
     * @notice Claim one sticker NFT with an EIP-712 voucher from the sticker verifier.
     * @param tokenId Sticker token id
     * @param signature EIP-712 signature over Claim(tokenId, msg.sender)
     */
    function claim(uint256 tokenId, bytes calldata signature) external nonReentrant {
        Sticker storage sticker = stickers[tokenId];
        if (!sticker.exists) revert StickerDoesNotExist();
        if (hasClaimed[tokenId][msg.sender]) revert AlreadyClaimed();

        bytes32 structHash = keccak256(abi.encode(CLAIM_TYPEHASH, tokenId, msg.sender));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(signature);

        if (signer != sticker.verifier) revert InvalidSignature();

        hasClaimed[tokenId][msg.sender] = true;
        _mint(msg.sender, tokenId, 1, "");

        emit StickerClaimed(tokenId, msg.sender);
    }

    /**
     * @notice Admin can update the metadata URI for their sticker.
     */
    function setTokenURI(uint256 tokenId, string calldata tokenURI_) external {
        Sticker storage sticker = stickers[tokenId];
        if (!sticker.exists) revert StickerDoesNotExist();
        if (msg.sender != sticker.admin) revert NotAdmin();
        if (bytes(tokenURI_).length == 0) revert InvalidURI();
        _setURI(tokenId, tokenURI_);
    }

    function nextTokenId() external view returns (uint256) {
        return _tokenIdCounter.current();
    }

    function uri(uint256 tokenId) public view override(ERC1155, ERC1155URIStorage) returns (string memory) {
        return ERC1155URIStorage.uri(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
