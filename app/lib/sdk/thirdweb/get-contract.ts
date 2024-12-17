import { CONTRACT_ADDRESS } from '@app/lib/utils/context';
import { getContract } from 'thirdweb';
import { polygonAmoy } from 'thirdweb/chains';
import { client } from './client';

export const videoContract = getContract({
  address: CONTRACT_ADDRESS.editionDrop.erc1155.amoy,
  chain: polygonAmoy,
  client,
});
