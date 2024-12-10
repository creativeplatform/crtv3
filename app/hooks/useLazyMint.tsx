import getContract from '@app/lib/sdk/thirdweb/get-contract';
import { CONTRACT_ADDRESS } from '@app/lib/utils/context';
import { ethers } from 'ethers';
import { useState } from 'react';
import { prepareContractCall, sendTransaction, toWei } from 'thirdweb';
import { useActiveAccount } from 'thirdweb/react';

function useLazyMint() {
  const wallet = useActiveAccount();
  const [txnHash, setTxnHash] = useState('');
  const [error, setError] = useState({});
  const [loading, setLoading] = useState(false);

  const lazyMint = async (
    amount: string,
    baseURIForTokens: string,
    data: any,
  ) => {
    const args: Record<string, any | string> = {
      amount,
      baseURIForTokens,
      data,
    };

    for (let key in args) {
      if (!args[key]) {
        throw new Error(`${key} is required`);
      }
    }

    const jsonString = JSON.stringify(data);
    const byteArr = Array.from(jsonString, (c) => c.charCodeAt(0));
    const hexData = ethers.hexlify(new Uint8Array(byteArr)) as `0x${string}`;

    const transaction = prepareContractCall({
      contract: getContract(CONTRACT_ADDRESS.editionDrop.erc1155.amoy),
      method:
        'function lazyMint(uint256 _amount, string _baseURIForTokens, bytes _data) returns (uint256 batchId)',
      params: [toWei(amount), baseURIForTokens, hexData],
    });

    try {
      setLoading(true);
      const { transactionHash } = await sendTransaction({
        transaction,
        account: wallet!,
      });

      setTxnHash(transactionHash);
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setError(err);
      setLoading(false);
    }
  };

  return {
    lazyMint,
    txnHash,
    error,
    loading,
  };
}

export default useLazyMint;
