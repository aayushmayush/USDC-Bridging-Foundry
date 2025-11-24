// setup-source.js
// Configure BridgeSource on Sepolia AND mint some USDC to user

const { ethers } = require("ethers");
require("dotenv").config();

const {
  SEPOLIA_RPC_URL,
  SEPOLIA_PRIVATE_KEY,
  DEST_CHAIN_ID,
  SOURCE_BRIDGE,
  USDC_SRC,
  USER_PRIVATE_KEY,
  SOURCE_MINT_AMOUNT,   // optional, in whole USDC
} = process.env;

if (
  !SEPOLIA_RPC_URL ||
  !SEPOLIA_PRIVATE_KEY ||
  !DEST_CHAIN_ID ||
  !SOURCE_BRIDGE ||
  !USDC_SRC ||
  !USER_PRIVATE_KEY
) {
  throw new Error(
    "Missing one of: SEPOLIA_RPC_URL, SEPOLIA_PRIVATE_KEY, DEST_CHAIN_ID, SOURCE_BRIDGE, USDC_SRC, USER_PRIVATE_KEY"
  );
}

const BRIDGE_SOURCE_ABI = [
  "function setSupportedChain(uint256 _chainId,bool _value) external",
  "function nextNonce() external view returns (uint256)",
];

const USDC_ABI_ADMIN = [
  "function grantMintRole(address _account) external",
  "function mint(address _account,uint256 _value) external",
  "function balanceOf(address) view returns (uint256)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
  const admin = new ethers.Wallet(SEPOLIA_PRIVATE_KEY, provider);
  const user = new ethers.Wallet(USER_PRIVATE_KEY, provider);

  console.log("➡️  Setting up SOURCE (Sepolia)");
  console.log("  Admin:", admin.address);
  console.log("  User:", user.address);
  console.log("  BridgeSource:", SOURCE_BRIDGE);
  console.log("  USDC_SRC:", USDC_SRC);
  console.log("  DEST_CHAIN_ID:", DEST_CHAIN_ID);

  const bridgeSource = new ethers.Contract(SOURCE_BRIDGE, BRIDGE_SOURCE_ABI, admin);
  const usdcAdmin = new ethers.Contract(USDC_SRC, USDC_ABI_ADMIN, admin);

  // 1) Mark destination chain as supported
  {
    const tx = await bridgeSource.setSupportedChain(Number(DEST_CHAIN_ID), true);
    console.log("  setSupportedChain tx:", tx.hash);
    await tx.wait();
    console.log("  ✓ BridgeSource.setSupportedChain done");
  }

  // 2) Ensure admin can mint + mint to user
  {
    const mintAmountWhole = SOURCE_MINT_AMOUNT || "1000"; // default 1000 USDC
    const mintAmount = ethers.parseUnits(mintAmountWhole, 6); // 6 decimals

    console.log(`  Granting MINT_ROLE to admin (if not already) and minting ${mintAmountWhole} USDC to user...`);

    // grant admin mint role (admin must be DEFAULT_ADMIN_ROLE on token)
    const txRole = await usdcAdmin.grantMintRole(admin.address);
    console.log("  grantMintRole tx:", txRole.hash);
    await txRole.wait();
    console.log("  ✓ grantMintRole(admin) done");

    // mint to user
    const txMint = await usdcAdmin.mint(user.address, mintAmount);
    console.log("  mint tx:", txMint.hash);
    await txMint.wait();
    console.log(`  ✓ Minted ${mintAmountWhole} USDC to user`);

    const bal = await usdcAdmin.balanceOf(user.address);
    console.log("  User USDC balance on source now:", bal.toString());
  }

  const nonce = await bridgeSource.nextNonce();
  console.log("  Current nextNonce on source bridge:", nonce.toString());
  console.log("Now call setup_destination.js");
}

main().catch((e) => {
  console.error("setup-source.js error:", e);
  process.exit(1);
});
