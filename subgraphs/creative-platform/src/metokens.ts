import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  Burn as BurnEvent,
  Mint as MintEvent,
  Register as RegisterEvent,
  Subscribe as SubscribeEvent
} from "../generated/MeTokens/MeTokens";
import { Transfer as TransferEvent } from "../generated/templates/MeToken/ERC20";
import { MeToken as MeTokenTemplate } from "../generated/templates";
import { Burn, Hub, Mint, Register, Subscribe } from "../generated/schema";
import { adjustMeTokenBalance, subtractMeTokenBalance } from "./balances";

const ZERO = Address.fromString("0x0000000000000000000000000000000000000000");

function entityId(event: ethereum.Event): Bytes {
  return event.transaction.hash.concatI32(event.logIndex.toI32());
}

export function handleSubscribe(event: SubscribeEvent): void {
  const entity = new Subscribe(entityId(event));
  entity.block_number = event.block.number;
  entity.timestamp_ = event.block.timestamp;
  entity.transactionHash_ = event.transaction.hash;
  entity.contractId_ = event.address;
  entity.meToken = event.params.meToken;
  entity.owner = event.params.owner;
  entity.minted = event.params.minted;
  entity.asset = event.params.asset;
  entity.assetsDeposited = event.params.assetsDeposited;
  entity.name = event.params.name;
  entity.symbol = event.params.symbol;
  entity.hubId = event.params.hubId;
  entity.save();

  // Credit initial mint to owner
  adjustMeTokenBalance(
    event.params.owner,
    event.params.meToken,
    event.params.minted,
    event.block.timestamp
  );

  // Track P2P Transfer events (mint/burn handled by Subscribe/Mint/Burn handlers)
  MeTokenTemplate.create(event.params.meToken);
}

export function handleMint(event: MintEvent): void {
  const entity = new Mint(entityId(event));
  entity.block_number = event.block.number;
  entity.timestamp_ = event.block.timestamp;
  entity.transactionHash_ = event.transaction.hash;
  entity.contractId_ = event.address;
  entity.meToken = event.params.meToken;
  entity.asset = event.params.asset;
  entity.depositor = event.params.depositor;
  entity.recipient = event.params.recipient;
  entity.assetsDeposited = event.params.assetsDeposited;
  entity.meTokensMinted = event.params.meTokensMinted;
  entity.save();

  adjustMeTokenBalance(
    event.params.recipient,
    event.params.meToken,
    event.params.meTokensMinted,
    event.block.timestamp
  );
}

export function handleBurn(event: BurnEvent): void {
  const entity = new Burn(entityId(event));
  entity.block_number = event.block.number;
  entity.timestamp_ = event.block.timestamp;
  entity.transactionHash_ = event.transaction.hash;
  entity.contractId_ = event.address;
  entity.meToken = event.params.meToken;
  entity.asset = event.params.asset;
  entity.burner = event.params.burner;
  entity.recipient = event.params.recipient;
  entity.meTokensBurned = event.params.meTokensBurned;
  entity.assetsReturned = event.params.assetsReturned;
  entity.save();

  subtractMeTokenBalance(
    event.params.burner,
    event.params.meToken,
    event.params.meTokensBurned,
    event.block.timestamp
  );
}

export function handleRegister(event: RegisterEvent): void {
  const entity = new Register(entityId(event));
  entity.block_number = event.block.number;
  entity.timestamp_ = event.block.timestamp;
  entity.transactionHash_ = event.transaction.hash;
  entity.contractId_ = event.address;
  entity.idParam = event.params.id;
  entity.owner = event.params.owner;
  entity.asset = event.params.asset;
  entity.vault = event.params.vault;
  entity.refundRatio = event.params.refundRatio;
  entity.baseY = event.params.baseY;
  entity.reserveWeight = event.params.reserveWeight;
  entity.encodedVaultArgs = event.params.encodedVaultArgs;
  entity.save();

  const hubId = event.params.id.toString();
  const hub = new Hub(hubId);
  hub.owner = event.params.owner;
  hub.asset = event.params.asset;
  hub.vault = event.params.vault;
  hub.refundRatio = event.params.refundRatio;
  hub.baseY = event.params.baseY;
  hub.reserveWeight = event.params.reserveWeight;
  hub.encodedVaultArgs = event.params.encodedVaultArgs;
  hub.active = true;
  hub.block_number = event.block.number;
  hub.timestamp_ = event.block.timestamp;
  hub.save();
}

export function handleTransfer(event: TransferEvent): void {
  const from = event.params.from;
  const to = event.params.to;
  const amount = event.params.value;
  const meToken = event.address;
  const timestamp = event.block.timestamp;

  // Skip mint/burn — already indexed via Subscribe, Mint, and Burn handlers
  if (from.equals(ZERO) || to.equals(ZERO)) {
    return;
  }

  subtractMeTokenBalance(from, meToken, amount, timestamp);
  adjustMeTokenBalance(to, meToken, amount, timestamp);
}
