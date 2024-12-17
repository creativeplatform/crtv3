import { videoContract } from '@app/lib/sdk/thirdweb/get-contract';
import { ethers } from 'ethers';
import { useCallback, useState } from 'react';
import { prepareContractCall, sendTransaction } from 'thirdweb';
import { useActiveAccount } from 'thirdweb/react';

function useLazyMint() {
  const wallet = useActiveAccount();
  const [txnHash, setTxnHash] = useState('');
  const [error, setError] = useState<Error>();
  const [isProcessing, setIsProcessing] = useState(false);

  const lazyMint = useCallback(
    async (amount: string, baseURIForTokens: string, data: any) => {
      const args: Record<string, any | string> = {
        amount,
        baseURIForTokens,
        data,
      };

      // TODO: get this validated
      for (let key in args) {
        if (!args[key]) {
          throw new Error(`${key} is required`);
        }
      }

      const priceInWei = ethers.parseUnits(data.price, 18);
      const abiCoder = new ethers.AbiCoder();

      const priceInWeiString = priceInWei.toString();
      const encodedData = abiCoder.encode(
        ['uint256'],
        [priceInWeiString],
      ) as `0x${string}`;

      const transaction = prepareContractCall({
        contract: videoContract,
        method:
          'function lazyMint(uint256 _amount, string _baseURIForTokens, bytes _data) returns (uint256 batchId)',
        params: [ethers.toBigInt(amount), baseURIForTokens, encodedData],
      });

      try {
        setIsProcessing(true);
        const { transactionHash } = await sendTransaction({
          transaction,
          account: wallet!,
        });

        setTxnHash(transactionHash);
        setIsProcessing(false);
      } catch (err: any) {
        console.error(err);
        setError(err);
        setIsProcessing(false);
      }
    },
    [wallet],
  );

  return {
    lazyMint,
    txnHash,
    error,
    isProcessing,
  };
}

export default useLazyMint;
