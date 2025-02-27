import { ContractOptions } from 'thirdweb';
import { NFTMetadata } from 'thirdweb/utils';

type Properties = {
  properties: {
    price: bigint;
    amount: bigint;
    createdAt: number;
  };
};
export type NFT = {
  metadata: NFTMetadata & Properties;
  owner: string | null;
  id: bigint;
  tokenURI: string;
  type: 'ERC1155';
  supply: bigint;
};

export type ResolvedReturnType<T> = T extends Promise<infer U> ? U : T;

export type TVideoContract = Readonly<ContractOptions<[]>> | undefined;