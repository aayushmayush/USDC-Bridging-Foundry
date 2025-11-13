// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import {USDCToken} from "../../src/USDC.sol";
import {IUSDC} from "../../src/interfaces/IUSDC.sol";
import {DeployUSDC} from "../../script/USDC/DeployUSDC.s.sol";
import {BridgeDestination} from "../../src/BridgeDestination.sol";

contract TestDestinationBridge is Test {
    USDCToken token;
    address deployer;
    address minter; // arbitrary relayer address
    IUSDC i_USDC;
    BridgeDestination bridge;
    address relayer = makeAddr("relayer");

    address aayush = makeAddr("aayush");
    address alice = makeAddr("alice");
    uint256 sourceChainId = 121121;
    address sourcebridgeAddress = makeAddr("srcBridgeAddr");
    address unregisteredSourcebridgeAddress = makeAddr("UnrgSrcBridgeAddr");
    uint256 nonce = 10;
    address srcToken = makeAddr("srcToken");

    function setUp() public {
        DeployUSDC deploy = new DeployUSDC();
        (deployer, minter, token) = deploy.run();
        i_USDC = IUSDC(address(token));
        vm.prank(deployer);
        bridge = new BridgeDestination(token);
    }

    function testTokenRegisteredInConstructor() public {
        assertEq(address(bridge.getUSDCTokenAddress()), address(token), "token didnt matched");
    }

    function testExecuteMintSuccess() public {
        vm.startPrank(deployer);
        token.grantMintRole(address(bridge));
        bridge.grantRelayerRole(relayer);
        bridge.setSourceBridge(sourceChainId, sourcebridgeAddress);
        vm.stopPrank();

        vm.prank(relayer);
        bridge.executeMint(sourceChainId, sourcebridgeAddress, nonce, srcToken, aayush, alice, 100_000_000);
    }

    function testExecuteMintRevertIfAlreadyProcessed() public {
        vm.startPrank(deployer);
        token.grantMintRole(address(bridge));
        bridge.grantRelayerRole(relayer);
        bridge.setSourceBridge(sourceChainId, sourcebridgeAddress);
        vm.stopPrank();

        vm.prank(relayer);
        bridge.executeMint(sourceChainId, sourcebridgeAddress, nonce, srcToken, aayush, alice, 100_000_000);

        vm.prank(relayer);
        vm.expectRevert();
        bridge.executeMint(sourceChainId, sourcebridgeAddress, nonce, srcToken, aayush, alice, 100_000_000);
    }

    function testExecuteMintRevertIfSourceBridgeChainNotAuthorized() public {
        vm.startPrank(deployer);
        token.grantMintRole(address(bridge));
        bridge.grantRelayerRole(relayer);
        bridge.setSourceBridge(sourceChainId, sourcebridgeAddress);
        vm.stopPrank();

        vm.prank(relayer);
        vm.expectRevert();
        bridge.executeMint(sourceChainId, unregisteredSourcebridgeAddress, nonce, srcToken, aayush, alice, 100_000_000);
    }

    function testUserBalanceTransferredCrossChainSuccessfully() public {
        vm.startPrank(deployer);
        token.grantMintRole(address(bridge));
        bridge.grantRelayerRole(relayer);
        bridge.setSourceBridge(sourceChainId, sourcebridgeAddress);
        vm.stopPrank();

        vm.prank(relayer);
        bridge.executeMint(
            sourceChainId,
            sourcebridgeAddress,
            nonce,
            srcToken,
            aayush,
            alice, //user whom balance is transferred crosschain
            100_000_000
        );

        assertEq(token.balanceOf(alice), 100_000_000, "Balance didnt matched");
    }

    function testExecuteMintFailOnCalledByNonRelayer() public {
        vm.startPrank(deployer);
        token.grantMintRole(address(bridge));
        bridge.grantRelayerRole(relayer);
        bridge.setSourceBridge(sourceChainId, sourcebridgeAddress);
        vm.stopPrank();

        vm.prank(aayush); //aayush is not a relayer
        vm.expectRevert();
        bridge.executeMint(sourceChainId, sourcebridgeAddress, nonce, srcToken, aayush, alice, 100_000_000);
    }
}
