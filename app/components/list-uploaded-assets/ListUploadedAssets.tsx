'use client';
import { fetchAllAssets } from '@app/api/livepeer/actions';
import { videoContract } from '@app/lib/sdk/thirdweb/get-contract';
import { Asset } from '@app/lib/types';
import { Box } from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { tokensLazyMintedEvent } from 'thirdweb/extensions/erc1155';
import { useContractEvents } from 'thirdweb/react';
import UploadAsset from './UploadedAsset';

type ListUploadedAssetsProps = {
  [index: string]: any;
  activeAccount: any;
};

let fetchUploadedAssets: () => void;

export default function ListUploadedAssets(props: ListUploadedAssetsProps) {
  const [assets, setAssets] = useState<Asset[] | {}>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  const lazyMintedEvent = useContractEvents({
    contract: videoContract,
    events: [
      tokensLazyMintedEvent({
        startTokenId: 0n,
      }),
    ],
  });

  useEffect(() => {
    fetchUploadedAssets = async () => {
      try {
        setIsLoading(true);

        const ast = await fetchAllAssets();
        setAssets(ast);

        setIsLoading(false);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUploadedAssets();
  }, [props]);

  // useEffect(() => {
  //   if (lazyMintedEvent.isSuccess) {
  //     console.log('lazyMintedEvent: ', lazyMintedEvent.data);
  //     fetchUploadedAssets();
  //   } else {
  //     console.error('lazyMintedEvent::error ', lazyMintedEvent.error?.message);
  //   }
  // }, [lazyMintedEvent.data, lazyMintedEvent.isSuccess]);

  const filteredCreatorAssets: Asset[] = useMemo(() => {
    return Array.isArray(assets)
      ? assets.filter(
          (ast: Asset) =>
            ast.creatorId &&
            ast.creatorId.value.toLowerCase() ==
              props.activeAccount.address.toLowerCase(),
        )
      : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, props.activeAccount.address]);

  if (error) {
    return (
      <Box mb={24}>
        <p>Error loading assets</p>{' '}
      </Box>
    );
  }

  return (
    <div className="mx-0 flex flex-col">
      {isLoading && filteredCreatorAssets.length === 0 && (
        <p className="text-[--brand-red-shade]">Loading assets...</p>
      )}

      {filteredCreatorAssets.length > 0 && (
        <>
          <h1 style={{ margin: '24px 0', fontSize: '18px' }}>
            List of uploaded videos
          </h1>
          <table className="w-full table-auto">
            <thead>
              <tr className="text-sm text-gray-600">
                <th className="border border-slate-600 px-4 py-1 ">S/No.</th>
                <th className="border border-slate-600 px-4 py-1 ">Name</th>
                <th className="border border-slate-600 px-4 py-1">Created</th>
                <th className="border border-slate-600 px-4 py-1">Updated</th>
                <th className="border border-slate-600 px-4 py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredCreatorAssets.map((video, i) => (
                <UploadAsset
                  activeAccount={props.activeAccount}
                  asset={video}
                  idx={i}
                  key={i}
                />
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
