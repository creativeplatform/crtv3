import useListLazyMinted from '@app/hooks/useLazyMinted';
import { parseIpfsUri } from '@app/lib/helpers/helpers';
import { NFT } from '@app/types/nft';
import { useCallback, useState } from 'react';
import ConfigureMintedAsset from '../configure-minted-asset/ConfigureMintedAsset';

type LazyMintedProps = {
  [index: string]: any;
  activeAccount: any;
};

export default function LazyMintedAsset(props: LazyMintedProps) {
  const { error, isProcessing, nfts } = useListLazyMinted();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nft, setNFT] = useState<NFT>();
  const [addClaimPhase, setAddClaimPhase] = useState(false);

  const toggleModal = useCallback(() => {
    setIsModalOpen((prevState) => !prevState);
  }, []);

  const handleViewMore = (_nft: NFT) => {
    toggleModal();
    setNFT(_nft);
  };

  return (
    <>
      {isProcessing && nfts.length === 0 && (
        <p className="my-2 text-lg text-[--brand-red-shade]">
          Loading minted nft(s)...
        </p>
      )}

      {error && <p className="my-2 text-lg text-red-500">{error.message}</p>}

      {!isProcessing && nfts.length === 0 && (
        <p className="my-2  text-lg text-gray-400">
          <span className=""></span> No minted nft yet!
        </p>
      )}

      {nfts && nfts.length > 0 && (
        <table className="w-full table-auto">
          <thead>
            <tr className="text-sm text-gray-600">
              <th className="border border-slate-600 px-4 py-1 ">ID</th>
              <th className="border border-slate-600 px-4 py-1">Media</th>
              <th className="border border-slate-600 px-4 py-1">Name</th>
              <th className="border border-slate-600 px-4 py-1">Description</th>
              <th className="border border-slate-600 px-4 py-1">Supply</th>
              <th className="border border-slate-600 px-4 py-1">More</th>
            </tr>
          </thead>
          <tbody>
            {nfts.map((nft, i) => (
              <tr
                key={i + '-' + nft.id}
                onClick={() => handleViewMore(nft)}
                className="hover:cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900"
              >
                <td className="border border-slate-700 px-4 py-1">
                  {nft.id.toLocaleString()}
                </td>
                <td className="border border-slate-700 px-4 py-1">
                  <video
                    src={parseIpfsUri(nft.metadata.animation_url!!)}
                    width={180}
                  ></video>
                  {/* TODO: Revisit Player */}
                  {/* <Player.Root src={nft.metadata.animation_url} /> */}
                </td>
                <td className="border border-slate-700 px-4 py-1">
                  {nft.metadata.name || 'No name'}
                </td>
                <td className="border border-slate-700 px-4 py-1">
                  {nft.metadata.description || 'No description'}
                </td>
                <td className="border border-slate-700 px-4 py-1">
                  {nft.supply.toString()}
                </td>
                <td className="border border-slate-700 px-4 py-1">{'->'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {isModalOpen && (
        <ConfigureMintedAsset
          nft={nft!!}
          toggleModal={toggleModal}
          setAddClaimPhase={setAddClaimPhase}
          addClaimPhase={addClaimPhase}
        />
      )}
    </>
  );
}
