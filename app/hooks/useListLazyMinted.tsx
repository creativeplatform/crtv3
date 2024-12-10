import getContract from '@app/lib/sdk/thirdweb/get-contract';
import { CONTRACT_ADDRESS } from '@app/lib/utils/context';
import { useEffect, useState } from 'react';
import { getNFTs } from 'thirdweb/extensions/erc1155';

function useListLazyMinted() {
  const [nfts, setNFTs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState({});

  useEffect(() => {
    setIsLoading(true);

    getNFTs({
      contract: getContract(CONTRACT_ADDRESS.editionDrop.erc1155.amoy),
      start: 0,
      count: 11,
    })
      .then((nfts) => {
        setNFTs([...nfts]);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setIsLoading(false);
        setError(err);
      });
  }, [nfts]);

  return {
    nfts,
    isLoading,
    error,
  };
}

export default useListLazyMinted;
