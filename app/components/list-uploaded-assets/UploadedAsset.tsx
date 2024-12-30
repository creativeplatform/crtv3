import * as helpers from '@app/lib/helpers/helpers';
import { videoContract } from '@app/lib/sdk/thirdweb/get-contract';
import { Asset } from '@app/lib/types';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { tokensLazyMintedEvent } from 'thirdweb/extensions/erc1155';
import { useContractEvents } from 'thirdweb/react';
import LazyMintModal from '../lazy-mint-modal/LazyMintModal';
import { Account } from 'thirdweb/wallets';

interface UploadAssetProps {
  idx: number;
  activeAccount: Account;
  asset: Asset;
}

export default function UploadAsset(props: UploadAssetProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const toggleModal = useCallback(() => {
    setIsModalOpen((prevState) => !prevState);
  }, []);

  const baseURIForTokenMemo = useMemo(
    () => props.asset.storage.ipfs.nftMetadata.gatewayUrl || '',
    [props.asset.storage.ipfs.nftMetadata.gatewayUrl],
  );

  const lazyMintedEvent = useContractEvents({
    contract: videoContract,
    events: [tokensLazyMintedEvent()],
  });

  useEffect(() => {
    if (lazyMintedEvent.isSuccess) {
      // TODO: fix with what should be done
      // console.log('lazyMintedEvent: ', lazyMintedEvent.data);
      // toggleModal();
    } else {
      // console.error('lazyMintedEvent::error ', lazyMintedEvent.error?.message);
    }
  }, [lazyMintedEvent]);

  return (
    <tr key={props.asset.id}>
      <td className="border border-slate-700 px-4 py-1">{props.idx + 1}</td>
      <td className="border border-slate-700 px-4 py-1">
        <Link
          href={`${props.activeAccount.address}/${props.asset.id}?video=${JSON.stringify(props.asset)}`}
        >
          {helpers.titleCase(
            props.asset.name.length > 12
              ? props.asset.name.slice(0, 9) + '...'
              : props.asset.name,
          )}
        </Link>
      </td>
      <td className="border border-slate-700 px-4 py-1">
        {helpers.parseTimestampToDate(props.asset.createdAt as any)}
      </td>
      <td className="border border-slate-700 px-4 py-1">
        {helpers.parseTimestampToDate(props.asset.status?.updatedAt as any)}
      </td>

      <td className="border border-slate-700 px-4 py-1">
        {/* TODO: Need to check how to fix this with
                      1. Fetch lazyMinted 
                      2. Filter its data against `filteredCreatorAssets`
         */}

        {props.asset.storage && props.asset.storage.ipfs.nftMetadata ? (
          <>
            <button onClick={toggleModal} className="text-orange-600">
              Mint Now
            </button>
          </>
        ) : (
          <p className="text-green-500">Minted</p>
        )}

        {isModalOpen && (
          <LazyMintModal
            baseURIForToken={baseURIForTokenMemo}
            toggleModal={toggleModal}
          />
        )}
      </td>
    </tr>
  );
}
