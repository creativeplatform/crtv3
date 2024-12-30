import { videoContract } from '@app/lib/sdk/thirdweb/get-contract';
import { useCallback, useState } from 'react';
import { sendTransaction } from 'thirdweb';
import { lazyMint } from 'thirdweb/extensions/erc1155';
import { useActiveAccount } from 'thirdweb/react';

interface LazyMintError extends Error {
  code?: string;
  message: string;
}

interface LazyMintArgs {
  amount: string;
  price: string;
  baseURIForTokens: string;
}

function useLazyMint() {
  const activeAccount = useActiveAccount();
  const [txnHash, setTxnHash] = useState('');
  const [error, setError] = useState<LazyMintError>();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleLazyMint = useCallback(
    async (args: LazyMintArgs) => {
 
      (Object.keys(args) as (keyof LazyMintArgs)[]).forEach((key) => {
        if (!args[key]) {
          throw new Error(`${key} is required`);
        }
      });

      try {
        setIsProcessing(true);

        const res = await fetch(args.baseURIForTokens);
        if (!res.ok) {
          throw new Error(`Failed to fetch metadata: ${res.statusText}`);
        }

        const data = await res.json();
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid metadata format');
        }

        const tknMetadata = Object.assign(data, {
          properties: {
            amount: args.amount,
            price: args.price,
            creatorAddress: activeAccount?.address || '',
          },
        });

        const transaction = lazyMint({
          contract: videoContract,
          nfts: [tknMetadata],
        });

        const { transactionHash } = await sendTransaction({
          transaction,
          account: activeAccount!,
        });

        setTxnHash(transactionHash);
        setIsProcessing(false);
      } catch (err) {
        console.error(err);
        setError(err as Error);
      } finally {
        setIsProcessing(false);
      }
    },
    [activeAccount],
  );

  return {
    handleLazyMint,
    txnHash,
    error,
    isProcessing,
  };
}

export default useLazyMint;
