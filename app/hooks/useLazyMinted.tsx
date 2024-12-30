import { videoContract } from '@app/lib/sdk/thirdweb/get-contract';
import { NFT } from '@app/types/nft';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getNFTs } from 'thirdweb/extensions/erc1155';
import { useActiveAccount } from 'thirdweb/react';

export default function useLazyMinted() {
  const activeAccount = useActiveAccount();

  const [nfts, setNFTs] = useState<NFT[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<Error>();

  const fetchLazyMintedNFTs = useCallback(async () => {
    if (!activeAccount) return;

    setIsProcessing(true);

    try {
      const data = (await getNFTs({
        contract: videoContract,
        start: 0,
      })) as NFT[];
      
      setIsProcessing(false);
      setNFTs(data);
    } catch (err) {
      setIsProcessing(false);
      console.error(err);
      setError(err as Error);
    }
  }, [activeAccount]);

  useEffect(() => {
    fetchLazyMintedNFTs();
  }, [activeAccount, fetchLazyMintedNFTs]);

  const activeAccountNFTs = useMemo(() => {
    return nfts.filter(
      (nft) =>
        nft.metadata.properties?.creatorAddress === activeAccount?.address,
    );
  }, [nfts, activeAccount]);

  return {
    nfts: activeAccountNFTs,
    isProcessing,
    error,
  };
}