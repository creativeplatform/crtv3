import { NFTMetadata } from "thirdweb/utils";

export type NFT = {
  metadata: NFTMetadata;
  owner: string | null;
  id: bigint;
  tokenURI: string;
  type: 'ERC1155';
  supply: bigint;
};
