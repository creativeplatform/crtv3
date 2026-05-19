import { Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  Burn as BurnEvent,
  Mint as MintEvent,
  Register as RegisterEvent,
  Subscribe as SubscribeEvent
} from "../generated/MeTokens/MeTokens";
import { Burn, Mint, Register, Subscribe } from "../generated/schema";

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
}
