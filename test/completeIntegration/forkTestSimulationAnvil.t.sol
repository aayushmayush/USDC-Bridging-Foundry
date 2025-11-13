//SPDX-License-Identifier:MIT
pragma solidity ^0.8.30;

import {Test, console} from "forge-std/Test.sol";
import {USDCToken} from "../../src/USDC.sol";
import {IUSDC} from "../../src/interfaces/IUSDC.sol";
import {BridgeSource} from "../../src/BridgeSource.sol";
import {BridgeDestination} from "../../src/BridgeDestination.sol";
import {DeployUSDC} from "../../script/USDC/DeployUSDC.s.sol";
import {Vm} from "forge-std/Vm.sol";

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
    address relayer = makeAddr("relayer");

    uint256 forkSepolia;
    uint256 forkArb;

    uint256 sepoliaChainId = 11155111; //source chain id
    uint256 arbChainId = 421614; //destination chain id

    function setUp() public {
        forkSepolia = vm.createFork("http://127.0.0.1:8545");
        forkArb = vm.createFork("http://127.0.0.1:8546");

        vm.selectFork(forkSepolia);

        DeployUSDC deploySrc = new DeployUSDC();
        (deployerSource, minterSource, usdcTokenSource) = deploySrc.run();
        i_usdcSource = IUSDC(address(usdcTokenSource));

        vm.startPrank(deployerSource);
        bridgeSource = new BridgeSource(usdcTokenSource);
        bridgeSource.setSupportedChain(arbChainId, true);
        vm.stopPrank();

        vm.startPrank(minterSource);
        i_usdcSource.mint(aayush, 1000_000_000); //1000 USDC
        vm.stopPrank();

        vm.selectFork(forkArb);
        DeployUSDC deployDst = new DeployUSDC();
        (deployerDestination, minterDestination, usdcTokenDST) = deployDst.run();
        i_usdcDestination = IUSDC(address(usdcTokenDST));

        vm.startPrank(deployerDestination);
        bridgeDestination = new BridgeDestination(usdcTokenDST);

        bridgeDestination.setSourceBridge(sepoliaChainId, address(bridgeSource));
        i_usdcDestination.grantMintRole(address(bridgeDestination));
        bridgeDestination.grantRelayerRole(relayer);
        vm.stopPrank();
    }

    function test_crossChain_flow_via_two_forks() public {
        vm.selectFork(forkSepolia);
        uint256 amount = 100_000_000;

        vm.startPrank(aayush);
        i_usdcSource.approve(address(bridgeSource), amount);

        vm.recordLogs();

        bridgeSource.bridgeOut(amount, alice, arbChainId);
        bytes32 bridgeRequestSig =
            keccak256("BridgeRequest(address,address,address,uint256,uint256,uint256,uint256,uint256)");

        Vm.Log[] memory entries = vm.getRecordedLogs();

        Vm.Log memory bridgeLog;
        bool found = false;

        for (uint256 i = 0; i < entries.length; i++) {
            if (entries[i].topics.length > 0 && entries[i].topics[0] == bridgeRequestSig) {
                bridgeLog = entries[i];
                found = true;
                break;
            }
        }

        require(found, "BridgeRequest event not found in logs");

        address from = address(uint160(uint256(bridgeLog.topics[1])));
        address to = address(uint160(uint256(bridgeLog.topics[2])));
        address tokenAddr = address(uint160(uint256(bridgeLog.topics[3])));

        (uint256 amountLog, uint256 srcChainId, uint256 dstChainId, uint256 nonce, uint256 timestamp) =
            abi.decode(bridgeLog.data, (uint256, uint256, uint256, uint256, uint256));

        // debug prints so you can see values in the -vvvv test output
        console.log("Decoded BridgeRequest:");
        console.log(" from:", from);
        console.log(" to:", to);
        console.log(" token:", tokenAddr);
        console.logUint(amountLog);
        console.log(" srcChainId:", srcChainId);
        console.log(" dstChainId:", dstChainId);
        console.log(" nonce:", nonce);
        console.log(" timestamp:", timestamp);

        // sanity checks (optional)
        assertEq(dstChainId, arbChainId, "dstChainId must equal expected arbChainId");
        assertEq(srcChainId, sepoliaChainId, "srcChainId must equal expected sepoliaChainId");

        // compute messageId the same way destination does
        bytes32 messageId = keccak256(abi.encodePacked(srcChainId, address(bridgeSource), tokenAddr, nonce));
        console.logBytes32(messageId);

        vm.stopPrank();

        vm.selectFork(forkArb);

        vm.prank(relayer);
        bridgeDestination.executeMint(srcChainId, address(bridgeSource), nonce, tokenAddr, from, to, amountLog);

        assertTrue(bridgeDestination.processed(messageId), "message must be marked processed on destination");

        assertEq(usdcTokenDST.balanceOf(to), amountLog, "destination recipient must have received minted amount");

        vm.prank(relayer);
        vm.expectRevert(); // AlreadyProcessed()
        bridgeDestination.executeMint(srcChainId, address(bridgeSource), nonce, tokenAddr, from, to, amountLog);

        vm.selectFork(forkSepolia);
        // check aayush balance decreased by amount
        assertEq(
            i_usdcSource.balanceOf(aayush),
            1000_000_000 - amount,
            "source user's balance should be reduced by burned amount"
        );
    }
}
