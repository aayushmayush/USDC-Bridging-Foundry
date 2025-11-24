// bridge-setup-and-flow.js
// Run with: node bridge-setup-and-flow.js
// Requires: npm install ethers dotenv

const { ethers } = require("ethers");
require("dotenv").config();

/**
 * ---- CONFIG (you ALREADY have most of this) ----
 * Make sure these are set in your .env:
 *
 * SEPOLIA_RPC_URL=...
 * ARB_SEPOLIA_RPC_URL=...
 *
 * SEPOLIA_ADMIN_PK=0x...       // deployer/admin on Sepolia (USDC src + BridgeSource owner)
 * ARB_ADMIN_PK=0x...           // deployer/admin on Arbitrum (USDC dst + BridgeDestination admin)
 *
 * USER_PRIVATE_KEY=0x...       // user who will hold USDC on Sepolia and call bridgeOut
 * RELAYER_PRIVATE_KEY=0x...    // already used by your relayer.js
 * RELAYER_ADDRESS=0x...        // 0xa4e0... (same as wallet from RELAYER_PRIVATE_KEY)
 */

const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL;
const ARB_RPC = process.env.ARB_SEPOLIA_RPC_URL;

const SEPOLIA_ADMIN_PK = process.env.SEPOLIA_PRIVATE_KEY;
const ARB_ADMIN_PK = process.env.ARB_SEPOLIA_PRIVATE_KEY;
const USER_PK = process.env.USER_PRIVATE_KEY;
const RELAYER_ADDRESS = process.env.RELAYER_ADDRESS;

// Hardcoded contract addresses you gave me:
const USDC_SRC = "0xaEa6EF034DcA53DDF3b02B9944E00888543b9bdA"; // Sepolia USDC
const USDC_DST = "0x6206521798aD35784A52DDd393f9A242138Ed55E"; // Arbitrum USDC

const BRIDGE_SOURCE = "0x5388887B8b444170B5fd0F22919073579Cc5bFEC"; // Sepolia BridgeSource
const BRIDGE_DEST = "0xb81A7F4dc018ef56481654B5C1c448D5d71FA2cA";   // Arbitrum BridgeDestination

// Chain IDs
const SRC_CHAIN_ID = 11155111; // Sepolia
const DST_CHAIN_ID = 421614;   // Arbitrum Sepolia

async function main() {
  if (!SEPOLIA_RPC || !ARB_RPC) {
    throw new Error("Missing SEPOLIA_RPC_URL or ARB_SEPOLIA_RPC_URL in .env");
  }
  if (!SEPOLIA_ADMIN_PK || !ARB_ADMIN_PK || !USER_PK || !RELAYER_ADDRESS) {
    throw new Error("Missing SEPOLIA_ADMIN_PK / ARB_ADMIN_PK / USER_PRIVATE_KEY / RELAYER_ADDRESS in .env");
  }

  // -------- Providers & wallets --------
  const srcProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const dstProvider = new ethers.JsonRpcProvider(ARB_RPC);

  const srcAdmin = new ethers.Wallet(SEPOLIA_ADMIN_PK, srcProvider);
  const dstAdmin = new ethers.Wallet(ARB_ADMIN_PK, dstProvider);
  const userSrc = new ethers.Wallet(USER_PK, srcProvider);

  console.log("Src admin:", srcAdmin.address);
  console.log("Dst admin:", dstAdmin.address);
  console.log("User (source):", userSrc.address);
  console.log("Relayer:", RELAYER_ADDRESS);

  // -------- Minimal ABIs --------
  const USDC_ABI_ADMIN = [
    "function grantMintRole(address _account) external",
    "function mint(address _account,uint256 _value) external",
    "function balanceOf(address) view returns (uint256)"
  ];

  const USDC_ABI_USER = [
    "function approve(address spender,uint256 amount) external returns (bool)",
    "function balanceOf(address) view returns (uint256)"
  ];

  const BRIDGE_SOURCE_ABI = [
    "function setSupportedChain(uint256 _chainId,bool _value) external",
    "function bridgeOut(uint256 _amount,address _to,uint256 _dstChainId) external",
    "function nextNonce() external view returns (uint256)"
  ];

  const BRIDGE_DEST_ABI = [
    "function setSourceBridge(uint256 _chainId,address _sourceBridgeAddress) external",
    "function grantRelayerRole(address _account) external",
    "function getUSDCTokenAddress() public view returns (address)"
  ];

  // -------- Contract instances --------
  const usdcSrcAdmin = new ethers.Contract(USDC_SRC, USDC_ABI_ADMIN, srcAdmin);
  const usdcDstAdmin = new ethers.Contract(USDC_DST, USDC_ABI_ADMIN, dstAdmin);

  const usdcSrcUser = new ethers.Contract(USDC_SRC, USDC_ABI_USER, userSrc);

  const bridgeSourceAdmin = new ethers.Contract(BRIDGE_SOURCE, BRIDGE_SOURCE_ABI, srcAdmin);
  const bridgeDestAdmin = new ethers.Contract(BRIDGE_DEST, BRIDGE_DEST_ABI, dstAdmin);

  console.log("\n=== STEP 1: Configure BridgeSource on Sepolia ===");
  {
    const tx = await bridgeSourceAdmin.setSupportedChain(DST_CHAIN_ID, true);
    console.log("setSupportedChain tx:", tx.hash);
    await tx.wait();
    console.log("✓ BridgeSource.setSupportedChain(", DST_CHAIN_ID, ", true) done");
  }

  console.log("\n=== STEP 2: Configure BridgeDestination on Arbitrum ===");
  {
    const tx1 = await bridgeDestAdmin.setSourceBridge(SRC_CHAIN_ID, BRIDGE_SOURCE);
    console.log("setSourceBridge tx:", tx1.hash);
    await tx1.wait();
    console.log("✓ BridgeDestination.setSourceBridge(", SRC_CHAIN_ID, ",", BRIDGE_SOURCE, ") done");

    const tx2 = await bridgeDestAdmin.grantRelayerRole(RELAYER_ADDRESS);
    console.log("grantRelayerRole tx:", tx2.hash);
    await tx2.wait();
    console.log("✓ BridgeDestination.grantRelayerRole(", RELAYER_ADDRESS, ") done");
  }

  console.log("\n=== STEP 3: Grant MINT_ROLE to BridgeDestination on dst USDC ===");
  {
    const tx = await usdcDstAdmin.grantMintRole(BRIDGE_DEST);
    console.log("grantMintRole (dest) tx:", tx.hash);
    await tx.wait();
    console.log("✓ USDC_DST.grantMintRole(BridgeDest) done");
  }

  console.log("\n=== STEP 4: Mint some USDC on Sepolia to user ===");
  {
    const amountToMint = ethers.parseUnits("1000", 6); // 1000 USDC
    const tx = await usdcSrcAdmin.mint(userSrc.address, amountToMint);
    console.log("mint tx:", tx.hash);
    await tx.wait();

    const bal = await usdcSrcAdmin.balanceOf(userSrc.address);
    console.log("✓ Minted 1000 USDC to user. New source balance:", bal.toString());
  }

  console.log("\n=== STEP 5: Approve BridgeSource and call bridgeOut from user ===");
  {
    const amountToBridge = ethers.parseUnits("10", 6); // 10 USDC
    console.log("User approving bridge to spend", amountToBridge.toString(), "on USDC_SRC");

    const approveTx = await usdcSrcUser.approve(BRIDGE_SOURCE, amountToBridge);
    console.log("approve tx:", approveTx.hash);
    await approveTx.wait();
    console.log("✓ approve done");

    // same ABI, but connect with user signer to call bridgeOut
    const bridgeSourceUser = bridgeSourceAdmin.connect(userSrc);
    const bridgeTx = await bridgeSourceUser.bridgeOut(amountToBridge, userSrc.address, DST_CHAIN_ID);
    console.log("bridgeOut tx:", bridgeTx.hash);
    await bridgeTx.wait();
    console.log("✓ bridgeOut done");

    const srcBalAfter = await usdcSrcUser.balanceOf(userSrc.address);
    console.log("User source balance after bridgeOut:", srcBalAfter.toString());
  }

  console.log("\nAll setup + one bridgeOut done.");
  console.log("If relayer.js is running, it should now pick this up and call executeMint on Arbitrum.");
}

main().catch((e) => {
  console.error("Script error:", e);
  process.exit(1);
});
