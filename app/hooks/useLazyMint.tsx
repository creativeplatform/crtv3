import { videoContract } from '@app/lib/sdk/thirdweb/get-contract';
import { useCallback, useState } from 'react';
import { sendTransaction } from 'thirdweb';
import { lazyMint } from 'thirdweb/extensions/erc1155';
import { useActiveAccount } from 'thirdweb/react';

function useLazyMint() {
  const activeAccount = useActiveAccount();
  const [txnHash, setTxnHash] = useState('');
  const [error, setError] = useState<Error>();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleLazyMint = useCallback(
    async (amount: string, price: string, baseURIForTokens: string) => {
      const args: Record<string, any | string> = {
        amount,
        price,
        baseURIForTokens,
      };

      // TODO: get this validated
      for (let key in args) {
        if (!args[key]) {
          // throw new Error(`${key} is required`);
        }
      }

      const res = await fetch(baseURIForTokens);
      const data = await res.json();
      const tknMetadata = Object.assign(data, {
        properties: {
          amount,
          price,
          creatorAddress: activeAccount?.address!,
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
      } catch (err: any) {
        console.error(err);
        setError(err);
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
