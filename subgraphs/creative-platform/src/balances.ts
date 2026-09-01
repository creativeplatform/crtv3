import { Address, BigInt } from "@graphprotocol/graph-ts";
import { MeTokenBalance } from "../generated/schema";

const ZERO = Address.fromString("0x0000000000000000000000000000000000000000");

function balanceId(user: Address, meToken: Address): string {
  return user.toHexString() + "-" + meToken.toHexString();
}

export function adjustMeTokenBalance(
  user: Address,
  meToken: Address,
  delta: BigInt,
  timestamp: BigInt
): void {
  if (user.equals(ZERO)) {
    return;
  }

  const id = balanceId(user, meToken);
  let entity = MeTokenBalance.load(id);

  if (entity == null) {
    entity = new MeTokenBalance(id);
    entity.user = user;
    entity.meToken = meToken;
    entity.balance = BigInt.zero();
  }

  entity.balance = entity.balance.plus(delta);
  entity.updatedAt = timestamp;
  entity.save();
}

export function subtractMeTokenBalance(
  user: Address,
  meToken: Address,
  amount: BigInt,
  timestamp: BigInt
): void {
  if (user.equals(ZERO)) {
    return;
  }

  const id = balanceId(user, meToken);
  let entity = MeTokenBalance.load(id);

  if (entity == null) {
    entity = new MeTokenBalance(id);
    entity.user = user;
    entity.meToken = meToken;
    entity.balance = BigInt.zero();
  }

  entity.balance = entity.balance.minus(amount);
  entity.updatedAt = timestamp;
  entity.save();
}
