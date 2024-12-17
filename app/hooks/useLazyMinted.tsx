import { videoContract } from '@app/lib/sdk/thirdweb/get-contract';
import { useEffect, useState } from 'react';
import { getNFTs } from 'thirdweb/extensions/erc1155';
import { NFTMetadata } from 'thirdweb/utils';

export type NFT = {
  metadata: NFTMetadata;
  owner: string | null;
  id: bigint;
  tokenURI: string;
  type: 'ERC1155';
  supply: bigint;
};

export default function useLazyMinted() {
  const [nfts, setNFTs] = useState<NFT[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<any>({});

  useEffect(() => {
    //
    const getLazyMintedNFTs = async () => {

      try {
        setIsProcessing(true);

        const nfts = await getNFTs({
          contract: videoContract,
          start: 0,
        });

        //////////////////////////////////////
        //TODO: filter nfts by owner as activeAccount
        /////////////////////////////////////

        const arr = Array.from(nfts) as Array<NFT>;
        const parsedNFTs = await parseMetadata(arr);

        setNFTs([...parsedNFTs]);
        setIsProcessing(false);
      } catch (err) {
        console.error(err);
        setIsProcessing(false);
        setError(err);
      }
    };

    getLazyMintedNFTs();
  }, []);

  return {
    nfts,
    isProcessing,
    error,
  };
}

function extractCID(ipfsUri: string) {
  return ipfsUri.split(/\/\//g)[1];
}

async function parseMetadata(arr: NFT[]) {
  const ast: NFT[] = [];
  const delimiter = 'ipfs/';

  for (let i = 0; i < arr.length; i++) {
    let cid = arr[i].metadata.uri.split(delimiter)[1].substring(0, 59);

    if (cid != undefined) {
      const res = await fetch(
        `https://ipfs.livepeer.studio/${delimiter}${cid}`,
      );

      const mtd: NFTMetadata = await res.json();

      if (mtd.animation_url != undefined || mtd.animation_url !== '') {
        mtd.animation_url = `https://ipfs.livepeer.studio/${delimiter}${extractCID(mtd.animation_url!!)}`;
      }

      if (mtd.image != undefined || mtd.image !== '') {
        mtd.image = `https://ipfs.livepeer.studio/${delimiter}${extractCID(mtd.image!!)}`
      }

      arr[i].metadata = {
        ...mtd,
      };
    }

    ast.push(arr[i]);
  }

  return ast;
}
