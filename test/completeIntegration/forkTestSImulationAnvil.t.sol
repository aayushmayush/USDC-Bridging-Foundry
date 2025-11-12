//SPDX-License-Identifier:MIT
pragma solidity ^0.8.30;

import {Test, console} from "forge-std/Test.sol";
import {USDCToken} from "../../src/USDC.sol";
import {IUSDC} from "../../src/interfaces/IUSDC.sol";
import {BridgeSource} from "../../src/BridgeSource.sol";
import {BridgeDestination} from "../../src/BridgeDestination.sol";
import {DeployUSDC} from "../../script/USDC/DeployUSDC.s.sol";

contract ForkTestSimulationIntegration is Test {
    USDCToken usdcTokenSource;
    USDCToken usdcTokenDST;
    BridgeSource bridgeSource;
    BridgeDestination bridgeDestination;
    IUSDC i_usdcSource;
    IUSDC i_usdcDestination;
    address deployerSource; //deployers would be same as I have same private key for both
    address deployerDestination;
    address minterSource;
    address minterDestination;

    address aayush = makeAddr("aayush");
    address alice = makeAddr("alice");
    address relayer=makeAddr("relayer");

    uint256 forkSepolia;
    uint256 forkArb;

    uint256 sepoliaChainId=11155111; //source chain id
    uint256 arbChainId=421614; //destination chain id

    function setUp() public {
        forkSepolia = vm.createFork("http://127.0.0.1:8545");
        forkArb = vm.createFork("http://127.0.0.1:8546");

        vm.selectFork(forkSepolia);

        DeployUSDC deploySrc = new DeployUSDC();
        (deployerSource, minterSource, usdcTokenSource) = deploySrc.run();
        i_usdcSource = IUSDC(address(usdcTokenSource));

        vm.prank(deployerSource);
        bridgeSource = new BridgeSource(usdcTokenSource);


        vm.startPrank(minterSource);
        i_usdcSource.mint(aayush,100_000_000);



        vm.selectFork(forkArb);
        DeployUSDC deployDst=new DeployUSDC();
        (deployerDestination,minterDestination,usdcTokenDST)=deployDst.run();
        i_usdcDestination=IUSDC(address(usdcTokenDST));

        vm.startPrank(deployerDestination);
        bridgeDestination=new BridgeDestination(usdcTokenDST);

        bridgeDestination.setSourceBridge(sepoliaChainId,address(bridgeSource));
        bridgeDestination.grantRelayerRole(relayer);
        vm.stopPrank();

        
    }
}
