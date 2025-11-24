// setup-destination.js
// Configure BridgeDestination on Arbitrum Sepolia and give it MINT_ROLE on dst USDC

const { ethers } = require("ethers");
require("dotenv").config();

const {
  ARB_SEPOLIA_RPC_URL,
  ARB_SEPOLIA_PRIVATE_KEY,
  SOURCE_CHAIN_ID,
  SOURCE_BRIDGE,
  DEST_BRIDGE,
  RELAYER_ADDRESS,
  USDC_DST,
} = process.env;

if (!ARB_SEPOLIA_RPC_URL || !ARB_SEPOLIA_PRIVATE_KEY || !SOURCE_CHAIN_ID || !SOURCE_BRIDGE || !DEST_BRIDGE || !RELAYER_ADDRESS || !USDC_DST) {
  throw new Error("Missing one of: ARB_SEPOLIA_RPC_URL, ARB_SEPOLIA_PRIVATE_KEY, SOURCE_CHAIN_ID, SOURCE_BRIDGE, DEST_BRIDGE, RELAYER_ADDRESS, USDC_DST");
}

const BRIDGE_DEST_ABI = [
  "function setSourceBridge(uint256 _chainId,address _sourceBridgeAddress) external",
  "function grantRelayerRole(address _account) external",
  "function sourceBridgeForChain(uint256) view returns (address)",
];

const USDC_ABI_ADMIN = [
  "function grantMintRole(address _account) external",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(ARB_SEPOLIA_RPC_URL);
  const admin = new ethers.Wallet(ARB_SEPOLIA_PRIVATE_KEY, provider);

  console.log("➡️  Setting up DESTINATION (Arbitrum Sepolia)");
  console.log("  Admin:", admin.address);
  console.log("  BridgeDestination:", DEST_BRIDGE);
  console.log("  USDC_DST:", USDC_DST);
  console.log("  Relayer:", RELAYER_ADDRESS);

  const bridgeDest = new ethers.Contract(DEST_BRIDGE, BRIDGE_DEST_ABI, admin);
  const usdcDst = new ethers.Contract(USDC_DST, USDC_ABI_ADMIN, admin);

  // 1) Wire source bridge
  const tx1 = await bridgeDest.setSourceBridge(Number(SOURCE_CHAIN_ID), SOURCE_BRIDGE);
  console.log("  setSourceBridge tx:", tx1.hash);
  await tx1.wait();
  console.log("  ✓ BridgeDestination now trusts source bridge for SOURCE_CHAIN_ID =", SOURCE_CHAIN_ID);

  // 2) Grant RELAYER_ROLE
  const tx2 = await bridgeDest.grantRelayerRole(RELAYER_ADDRESS);
  console.log("  grantRelayerRole tx:", tx2.hash);
  await tx2.wait();
  console.log("  ✓ RELAYER_ROLE granted to:", RELAYER_ADDRESS);

  // 3) Give BridgeDestination mint rights on dst USDC
  const tx3 = await usdcDst.grantMintRole(DEST_BRIDGE);
  console.log("  grantMintRole (dst) tx:", tx3.hash);
  await tx3.wait();
  console.log("  ✓ USDC_DST.grantMintRole(DEST_BRIDGE) done.");
  console.log("now call node relyaer.js on another tab and in this tab call node bridge_out.js");
}

main().catch((e) => {
  console.error("setup-destination.js error:", e);
  process.exit(1);
});
