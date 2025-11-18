// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

// This contract isDeployed on sepolia at addr 0xb81A7F4dc018ef56481654B5C1c448D5d71FA2cA after deploying USDC token at sepolia and harcoded its address , you can redeploy and change the USDC token address

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/Test.sol";
import {BridgeDestination} from "../src/BridgeDestination.sol";
import {USDCToken} from "../src/USDC.sol";
contract DeployBridgeDestination is Script {
    function run() external returns (address) {
        uint256 deployerKey;
        //I deployed the usdc token on arbitrum and got the contract address //0x6206521798aD35784A52DDd393f9A242138Ed55E so I will use this in constructor
        address tokenDeployed=0x6206521798aD35784A52DDd393f9A242138Ed55E;
        if (block.chainid ==421614) {
            deployerKey = vm.envUint("ARB_SEPOLIA_PRIVATE_KEY");
        } else {
            deployerKey = vm.envUint("ANVIL_PRIVATE_KEY");
        }



        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployer);

        // Deploy the USDCToken
        BridgeDestination bridgeDst= new BridgeDestination(USDCToken(tokenDeployed));



        vm.stopBroadcast();

        return (address(bridgeDst));
    }
}
