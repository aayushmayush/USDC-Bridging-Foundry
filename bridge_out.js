// bridge-out.js
// User script: approve USDC to BridgeSource and call bridgeOut

const { ethers } = require("ethers");
require("dotenv").config();

const {
  SEPOLIA_RPC_URL,
  USER_PRIVATE_KEY,
  USDC_SRC,
  SOURCE_BRIDGE,
  DEST_CHAIN_ID,
  DEST_RECEPIENT,
  BRIDGE_AMOUNT,      // optional, in whole USDC (defaults to 10)
} = process.env;

if (!SEPOLIA_RPC_URL || !USER_PRIVATE_KEY || !USDC_SRC || !SOURCE_BRIDGE || !DEST_CHAIN_ID || !DEST_RECEPIENT) {
  throw new Error("Missing one of: SEPOLIA_RPC_URL, USER_PRIVATE_KEY, USDC_SRC, SOURCE_BRIDGE, DEST_CHAIN_ID, DEST_RECEPIENT");
}

const USDC_ABI_USER = [
  "function approve(address spender,uint256 amount) external returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

const BRIDGE_SOURCE_ABI = [
  "function bridgeOut(uint256 _amount,address _to,uint256 _dstChainId) external",
  "function nextNonce() external view returns (uint256)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
  const user = new ethers.Wallet(USER_PRIVATE_KEY, provider);

  const amountUsdc = BRIDGE_AMOUNT || "10"; // default 10 USDC
  const amount = ethers.parseUnits(amountUsdc, 6); // USDC has 6 decimals

  console.log("➡️  Running bridge-out from SOURCE (Sepolia)");
  console.log("  User:", user.address);
  console.log("  USDC_SRC:", USDC_SRC);
  console.log("  BridgeSource:", SOURCE_BRIDGE);
  console.log("  Dest recipient:", DEST_RECEPIENT);
  console.log("  Dest chainId:", DEST_CHAIN_ID);
  console.log("  Amount:", amountUsdc, "USDC");

  const usdc = new ethers.Contract(USDC_SRC, USDC_ABI_USER, user);
  const bridgeSource = new ethers.Contract(SOURCE_BRIDGE, BRIDGE_SOURCE_ABI, user);

  const balBefore = await usdc.balanceOf(user.address);
  console.log("  User USDC balance before:", balBefore.toString());

  // 1) Approve bridge
  const approveTx = await usdc.approve(SOURCE_BRIDGE, amount);
  console.log("  approve tx:", approveTx.hash);
  await approveTx.wait();
  console.log("  ✓ approve done");

  // 2) bridgeOut
  const bridgeTx = await bridgeSource.bridgeOut(amount, DEST_RECEPIENT, Number(DEST_CHAIN_ID));
  console.log("  bridgeOut tx:", bridgeTx.hash);
  const receipt = await bridgeTx.wait();
  console.log("  ✓ bridgeOut mined in block", receipt.blockNumber);

  const balAfter = await usdc.balanceOf(user.address);
  console.log("  User USDC balance after:", balAfter.toString());

  const nextNonce = await bridgeSource.nextNonce();
  console.log("  Next nonce on source bridge:", nextNonce.toString());
  console.log("Now you should be able to see the cross transfer getting completed on relayer.js")
}

main().catch((e) => {
  console.error("bridge-out.js error:", e);
  process.exit(1);
});
