import { videoContract } from '@app/lib/sdk/thirdweb/get-contract';
import { useCallback, useState } from 'react';
import { sendTransaction } from 'thirdweb';
import { lazyMint } from 'thirdweb/extensions/erc1155';
import { useActiveAccount } from 'thirdweb/react';

interface LazyMintArgs {
  amount: string;
  price: string;
  baseURIForTokens: string;
}

function useLazyMint() {
  const activeAccount = useActiveAccount();
  const [txnHash, setTxnHash] = useState('');
  const [error, setError] = useState<Error>();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleLazyMint = useCallback(
    async (args: LazyMintArgs) => {
      // TODO: get this validated
      (Object.keys(args) as (keyof LazyMintArgs)[]).forEach((key) => {
        if (!args[key]) {
          // throw new Error(`${key} is required`);
        }
      });

      const res = await fetch(args.baseURIForTokens);
      const data = await res.json();
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

      try {
        setIsProcessing(true);
        const { transactionHash } = await sendTransaction({
          transaction,
          account: activeAccount!,
        });

        setTxnHash(transactionHash);
        setIsProcessing(false);
      } catch (err) {
        console.error(err);
        setError(err as Error);
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
