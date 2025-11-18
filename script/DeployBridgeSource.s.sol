// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

//This contract is Deployed on sepolia at addr 0x5388887B8b444170B5fd0F22919073579Cc5bFEC after deploying USDC token at sepolia and harcoded its address , you can redeploy and change the USDC token address

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/Test.sol";
import {BridgeSource} from "../src/BridgeSource.sol";
import {USDCToken} from "../src/USDC.sol";
contract DeployBridgeSource is Script {
    function run() external returns (address) {
        uint256 deployerKey;
        //I deployed the usdc token and got the contract address //0xaEa6EF034DcA53DDF3b02B9944E00888543b9bdA so I will use this in constructor
        address tokenDeployed=0xaEa6EF034DcA53DDF3b02B9944E00888543b9bdA;
        if (block.chainid == 11155111) {
            deployerKey = vm.envUint("SEPOLIA_PRIVATE_KEY");
        } else {
            deployerKey = vm.envUint("ANVIL_PRIVATE_KEY");
        }



        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployer);

        // Deploy the USDCToken
        BridgeSource bridge= new BridgeSource(USDCToken(tokenDeployed));



        vm.stopBroadcast();

        return (address(bridge));
    }
}
