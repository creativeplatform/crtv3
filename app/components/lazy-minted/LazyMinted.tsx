import useListLazyMinted from '@app/hooks/useLazyMinted';
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


  const toggleModal = useCallback(() => {
    setIsModalOpen((prevState) => !prevState);
  }, []);

  const handleViewMore = (_nft: NFT) => {
    toggleModal();
    setNFT(_nft);
  };

  return (
    <>
      {isProcessing && (
        <p className="text-[--brand-red-shade]">Loading minted nft(s)...</p>
      )}

      {!isProcessing && nfts.length === 0 && (
        <p className="text-sm text-gray-400">No minted nft yet!</p>
      )}

      {error && <p className="text-sm text-red-500">{error.message}</p>}

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
              <tr key={i + '-' + nft.id}>
                <td className="border border-slate-700 px-4 py-1">
                  {nft.id.toLocaleString()}
                </td>
                <td className="border border-slate-700 px-4 py-1">
                  <video src={nft.metadata.animation_url} width={120}></video>
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
                <td className="border border-slate-700 px-4 py-1">
                  <button onClick={() => handleViewMore(nft)}>
                    {'Configure'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {isModalOpen && (
        <ConfigureMintedAsset nft={nft!!} toggleModal={toggleModal} />
      )}
    </>
  );
}
