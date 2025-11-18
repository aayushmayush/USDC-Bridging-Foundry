//relayer.ts

import {ethers} from "ethers";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

/**
 * Simple relayer:
 * - listens to BridgeRequest events on SOURCE chain
 * - waits CONFIRMATIONS blocks
 * - validates dstChainId
 * - computes messageId = keccak256(srcChainId, srcBridgeAddress, nonce)
 * - checks destination processed(messageId)
 * - calls executeMint(...) on DEST_BRIDGE as RELAYER
 */

