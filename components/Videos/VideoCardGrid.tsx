import React from 'react'
import { Box, SimpleGrid, Text } from '@chakra-ui/react';
import VideoCard from './VideoCard';
import { AssetData } from '../../utils/fetchers/assets';

interface VideoCardGridProps {
    videos: AssetData['video'][];
}

const VideoCardGrid: React.FC<VideoCardGridProps> = ({ videos }) => {
    if (videos.length === 0) {
        return <Box p={5}><Text>No videos available. Please check back later.</Text></Box>;
    }
    return (
    <Box p={5}>
      <SimpleGrid minChildWidth="300px" spacing="40px" autoColumns={'max-content'}>
        {videos.map((video) => (
          <VideoCard key={video?.assetId} video={video} />
        ))}
      </SimpleGrid>
    </Box>
    );
  };
  
export default VideoCardGrid;
