import dotenv from "dotenv";
import {
  createPublicClient,
  createWalletClient,
  encodePacked,
  http,
  keccak256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { EAS_SCHEMA_REGISTRY_ADDRESS, EAS_UPLOAD_SCHEMA } from "@/lib/eas/config";

dotenv.config({ path: ".env.local" });

const PRIVATE_KEY = process.env.EAS_SCHEMA_REGISTRAR_PRIVATE_KEY;
const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

const SCHEMA_REGISTRY_ABI = [
  {
    type: "function",
    name: "register",
    inputs: [
      { name: "schema", type: "string" },
      { name: "resolver", type: "address" },
      { name: "revocable", type: "bool" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
] as const;

function getSchemaUID(
  schema: string,
  resolverAddress: `0x${string}`,
  revocable: boolean,
) {
  return keccak256(
    encodePacked(["string", "address", "bool"], [schema, resolverAddress, revocable]),
  );
}

if (!PRIVATE_KEY || !ALCHEMY_KEY) {
  console.error(
    "Missing env vars: EAS_SCHEMA_REGISTRAR_PRIVATE_KEY and NEXT_PUBLIC_ALCHEMY_API_KEY must be set in .env.local",
  );
  process.exit(1);
}

const account = privateKeyToAccount(
  PRIVATE_KEY.startsWith("0x")
    ? (PRIVATE_KEY as `0x${string}`)
    : (`0x${PRIVATE_KEY}` as `0x${string}`),
);

const rpcUrl = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;
const transport = http(rpcUrl);

const walletClient = createWalletClient({
  account,
  chain: base,
  transport,
});

const publicClient = createPublicClient({
  chain: base,
  transport,
});

async function main() {
  const resolverAddress = ZERO_ADDRESS;
  const revocable = false;
  const schemaUid = getSchemaUID(EAS_UPLOAD_SCHEMA, resolverAddress, revocable);

  console.log("Registering schema:\n", EAS_UPLOAD_SCHEMA);
  console.log("Expected schema UID:", schemaUid);

  const hash = await walletClient.writeContract({
    address: EAS_SCHEMA_REGISTRY_ADDRESS as `0x${string}`,
    abi: SCHEMA_REGISTRY_ABI,
    functionName: "register",
    args: [EAS_UPLOAD_SCHEMA, resolverAddress, revocable],
  });

  console.log("Transaction hash:", hash);
  await publicClient.waitForTransactionReceipt({ hash });

  console.log("Schema registered successfully.");
  console.log("Schema UID:", schemaUid);
  console.log("");
  console.log("Add this to your .env.local:");
  console.log(`NEXT_PUBLIC_EAS_UPLOAD_SCHEMA_UID=${schemaUid}`);
}

main().catch((err) => {
  console.error("Schema registration failed:", err);
  process.exit(1);
});
