// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/JobEscrow.sol";
import "../src/AgentIdentityRegistry.sol";
import "../src/ReputationRegistry.sol";

contract DeployAll is Script {
    // Base Mainnet USDC
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer:", deployer);
        console.log("Deploying ERC-8004 compliant contracts...");
        
        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Identity Registry
        AgentIdentityRegistry identityRegistry = new AgentIdentityRegistry();
        console.log("AgentIdentityRegistry deployed to:", address(identityRegistry));

        // 2. Deploy Reputation Registry (linked to Identity Registry)
        ReputationRegistry reputationRegistry = new ReputationRegistry(address(identityRegistry));
        console.log("ReputationRegistry deployed to:", address(reputationRegistry));

        // 3. Deploy Job Escrow (fee recipient = deployer)
        JobEscrow escrow = new JobEscrow(USDC, deployer);
        console.log("JobEscrow deployed to:", address(escrow));

        vm.stopBroadcast();

        console.log("");
        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("Identity Registry:", address(identityRegistry));
        console.log("Reputation Registry:", address(reputationRegistry));
        console.log("Job Escrow:", address(escrow));
        console.log("USDC:", USDC);
        console.log("Fee Recipient:", deployer);
    }
}
