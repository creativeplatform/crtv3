import { fetchAllAssets } from '@app/api/livepeer/actions';
import useLazyMint from '@app/hooks/useLazyMint';
import * as helpers from '@app/lib/helpers';
import { Asset } from '@app/lib/types';
import { Box, Link, Spinner } from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import Modal from '../Modal';

type ListUploadedAssetsProps = {
  [index: string]: any;
  activeAccount: any;
};

export default function ListUploadedAssets(props: ListUploadedAssetsProps) {
  const [assets, setAssets] = useState<Asset[] | {}>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchAllAssets()
      .then((ast) => {
        setIsLoading(true);

        setAssets(ast as any);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [props]);

  const filteredCreatorAssets: Asset[] = useMemo(() => {
    return Array.isArray(assets)
      ? assets.filter(
          (ast: Asset) =>
            ast.creatorId &&
            ast.creatorId.value.toLowerCase() ==
              props.activeAccount.address.toLowerCase(),
        )
      : [];
  }, [assets, props.activeAccount.address]);

  if (error) {
    return (
      <Box mb={24}>
        <p>Error loading assets</p>{' '}
      </Box>
    );
  }

  return (
    <div>
      {isLoading && <Spinner />}

      {filteredCreatorAssets.length > 0 && (
        <>
          <h1 style={{ margin: '24px 0', fontSize: '18px' }}>
            List of uploaded videos
          </h1>
          <table className="w-full table-auto">
            <thead>
              <tr className="text-sm text-gray-600">
                <th className="border border-slate-600 px-4 py-1 ">Name</th>
                <th className="border border-slate-600 px-4 py-1">Created</th>
                <th className="border border-slate-600 px-4 py-1">Updated</th>
                <th className="border border-slate-600 px-4 py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredCreatorAssets.map((video, i) => (
                <tr key={i}>
                  <td className="border border-slate-700 px-4 py-1">
                    <Link
                      href={`${props.activeAccount.addresss}/${video.id}?video=${JSON.stringify(video)}`}
                    >
                      {helpers.titleCase(
                        video?.name.length > 12
                          ? video?.name.slice(0, 9) + '...'
                          : video?.name,
                      )}
                    </Link>
                  </td>
                  <td className="border border-slate-700 px-4 py-1">
                    {helpers.parseTimestampToDate(video?.createdAt as any)}
                  </td>
                  <td className="border border-slate-700 px-4 py-1">
                    {helpers.parseTimestampToDate(
                      video?.status?.updatedAt as any,
                    )}
                  </td>

                  <td className="border border-slate-700 px-4 py-1">
                    {/* TODO: Need to check how to fix this with
                      1. Fetch lazyMinted 
                      2. Filter its data against `filteredCreatorAssets`
                    */}
                    {video.storage && video.storage.ipfs.nftMetadata ? (
                      <Modal
                        title="Lazy Mint"
                        triggerText="Need Minting"
                        body={
                          <Body
                            baseURIForToken={
                              video.storage &&
                              String(video.storage.ipfs.nftMetadata.gatewayUrl)
                            }
                          />
                        }
                      />
                    ) : (
                      'Minted'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="modal-box"></div>
        </>
      )}
    </div>
  );
}

type BodyProps = {
  baseURIForToken: string;
};

function Body(props: BodyProps) {
  const { lazyMint } = useLazyMint();
  const [formData, setFormData] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = e.target;
    const value = target.value;
    const name = target.name;

    setFormData((prev) => {
      return { ...prev, [name]: value };
    });
  };

  const handleLazyMinting = (e: React.FormEvent) => {
    e.preventDefault();

    lazyMint(formData.amount, props.baseURIForToken, {
      price: formData.price,
    });
  };

  return (
    <>
      <form>
        <div>
          <label htmlFor="amount">
            <input
              type="text"
              name="amount"
              id="amount"
              placeholder="Amount to mint"
              onChange={handleChange}
            />
          </label>
        </div>
        <div>
          <label htmlFor="price">
            <input
              type="text"
              name="price"
              id="price"
              placeholder="Price of NFT"
              onChange={handleChange}
            />
          </label>
        </div>

        <button onClick={handleLazyMinting}>
          {status === 'pending' ? 'Minting' : 'Mint'}
        </button>
      </form>
    </>
  );
}
