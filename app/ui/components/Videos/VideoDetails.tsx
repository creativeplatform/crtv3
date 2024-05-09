'use client';

import { LivepeerCacheAsset } from '@app/lib/types';
import { Box, Container, Heading } from '@chakra-ui/react';
import { Player } from '@livepeer/react';
import { useState } from 'react';

type VideoDetailsProps = {
  asset: LivepeerCacheAsset;
};

export default function VideoDetails(props: VideoDetailsProps) {
  const [videoDetails, setVideoDetails] = useState();
  const [asset, setAsset] = useState<any>();
  const [isLoading, setIsLoading] = useState(false);
  const [assetLoading, setAssetLoading] = useState(false);
  const [error, setError] = useState('');

  // useEffect(() => {
  // console.log('VideoDetails::params: ', params);

  // const fetchVideoDetails = async () => {
  //   setIsLoading(true);
  //   try {
  // const response = await fetch(`asset/${params.slug}`);
  // const data = await response.json();
  // setVideoDetails(data);
  // Once video details are fetched, fetch the asset
  // await fetchAssetDetails(data.assetId);
  //   } catch (err) {
  //     setError('Failed to load video data');
  //     console.error(err);
  //   }
  //   setIsLoading(false);
  // };

  // fetchVideoDetails();
  // }, [params.id]);

  // const fetchAssetDetails = async (assetId: AssetData) => {
  //   setAssetLoading(true);
  //   try {
  //     const assetData = await livepeer?.asset.get(`${assetId.assetId}`);
  //     console.log('Asset By Id', assetData);
  //     setAsset(assetData);
  //   } catch (err) {
  //     setError('Failed to load asset data');
  //     console.error(err);
  //   }
  //   setAssetLoading(false);
  // };

  return (
    <main>
      <Heading p={4}>Video Detail Page</Heading>
      <Box p={4}>Asset ID: {props.asset.id}</Box>
      {isLoading || assetLoading ? (
        <Box>Loading...</Box>
      ) : error ? (
        <Box color="red.500">{error}</Box>
      ) : (
        <Container maxW="container.md">
          <Heading size="md" my="4">
            {videoDetails}
          </Heading>
          {/* {props.asset.id && <Player playbackId={props.asset.playbackId} showTitle />} */}
        </Container>
      )}
    </main>
  );
}
