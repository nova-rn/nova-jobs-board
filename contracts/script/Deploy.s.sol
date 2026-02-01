// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/JobEscrow.sol";

contract DeployJobEscrow is Script {
    // Base Mainnet USDC
    address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    
    // Fee recipient (Nova's wallet)
    address constant FEE_RECIPIENT = 0x8e2Aec961519d0F0C096802144C2D5856FFBCf75;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        JobEscrow escrow = new JobEscrow(BASE_USDC, FEE_RECIPIENT);
        
        console.log("JobEscrow deployed to:", address(escrow));
        console.log("USDC address:", BASE_USDC);
        console.log("Fee recipient:", FEE_RECIPIENT);
        
        vm.stopBroadcast();
    }
}
