// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../contracts/CampaignStickers.sol";

/// Minimal cheatcodes for broadcast without forge-std Script
interface VmScript {
    function startBroadcast() external;
    function stopBroadcast() external;
}

/**
 * @notice Deploy CampaignStickers to Base (or any EVM chain).
 * Usage:
 *   forge script script/DeployCampaignStickers.s.sol:DeployCampaignStickers \
 *     --rpc-url $BASE_RPC_URL --broadcast --private-key $DEPLOYER_PRIVATE_KEY
 */
contract DeployCampaignStickers {
    VmScript internal constant vm = VmScript(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external {
        vm.startBroadcast();
        CampaignStickers stickers = new CampaignStickers();
        // solhint-disable-next-line no-console
        // address is available as stickers; log via return for scripts that capture it
        stickers;
        vm.stopBroadcast();
    }
}
