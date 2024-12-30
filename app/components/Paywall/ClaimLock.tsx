'use client';

import { UserMenu } from '@app/components/Layout/userMenu';
import { client } from '@app/lib/sdk/thirdweb/client';
import Unlock from '@app/lib/utils/Unlock.json';
import { CREATIVE_ADDRESS } from '@app/lib/utils/context';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getContract, prepareContractCall, toWei } from 'thirdweb';
import { base } from 'thirdweb/chains';
import {
  TransactionButton,
  useActiveAccount,
  useReadContract,
} from 'thirdweb/react';

interface UserMenuProps {
  closeMenu: () => void;
}

function ClaimLockButton({ closeMenu }: { closeMenu: () => void }) {
  const activeAccount = useActiveAccount();

  const unlockAbi = Unlock.abi;
  const unlockContract = getContract({
    client: client,
    chain: base,
    address: '0xf7c4cd399395d80f9d61fde833849106775269c6',
    // address: CONTRACT_ADDRESS.gateway.base.erc721,
    abi: unlockAbi as any,
  });

  const { data: result, isLoading } = useReadContract({
    contract: unlockContract,
    method: 'getHasValidKey',
    params: [activeAccount?.address],
  });

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const handleLinkClick = () => {
    setIsMenuOpen(false);
  };

  useEffect(() => {
    if (!activeAccount || !unlockAbi) return;

    if (result !== undefined) {
      console.log('Valid Membership?', result);
      setSubscribed(result);
    }
  }, [activeAccount, unlockAbi, result]);

  return (
    <div className="mx-auto">
      <div className="my-2 flex flex-row">
        {activeAccount && subscribed === true ? (
          <UserMenu />
        ) : (
          <TransactionButton
            payModal={{
              metadata: {
                name: 'Creator Pass',
                image:
                  'https://bafybeiemndtnhajevhwep7mrzx62slcp6nklpw4zwq3dcqvqugj7tqem44.ipfs.w3s.link/Creator%20Membership%20Pass_both.gif',
              },
              buyWithCrypto: {
                testMode: false,
              },
              buyWithFiat: {
                prefillSource: {
                  currency: 'USD',
                },
              },
              purchaseData: {},
              supportedTokens: {
                137: [
                  {
                    address: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
                    name: 'USDC',
                    symbol: 'USDC',
                    icon: 'https://bafybeidzrdgq3vllhxcza6uvkvecxdumgsgkrq22pm3sqdviujttridkku.ipfs.w3s.link/usd-coin-usdc-logo.png',
                  },
                ],
                8453: [
                  {
                    address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
                    name: 'USDC',
                    symbol: 'USDC',
                    icon: 'https://bafybeidzrdgq3vllhxcza6uvkvecxdumgsgkrq22pm3sqdviujttridkku.ipfs.w3s.link/usd-coin-usdc-logo.png',
                  },
                ],
              },
            }}
            transaction={() => {
              const tx = prepareContractCall({
                contract: unlockContract,
                method: 'purchase',
                params: [
                  [30000000000000000000],
                  [activeAccount?.address],
                  [CREATIVE_ADDRESS],
                  [CREATIVE_ADDRESS],
                  ['0x'],
                ],
                value: toWei('30'),
              });
              return tx;
            }}
            onTransactionConfirmed={() => {
              toast('Transaction Successful');
            }}
            onError={() => {
              toast('Transaction Failed');
            }}
          >
            Claim Pass
          </TransactionButton>
        )}
      </div>
    </div>
  );
}
export default ClaimLockButton;
