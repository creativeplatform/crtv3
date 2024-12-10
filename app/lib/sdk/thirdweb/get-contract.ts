import { getContract as gContract } from 'thirdweb';
import { Chain, sepolia } from 'thirdweb/chains';
import { client } from './client';

const getContract = (address: string, chain: Chain = sepolia) => {
  return gContract({
    client,
    address,
    chain,
  });
};

export default getContract;
