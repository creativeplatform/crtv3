import React from 'react';
import { SimpleGrid, Heading } from '@chakra-ui/react';
import VideoCardGrid from './VideoCardGrid';

export default async function AllAssets() {

  return (
    <section>
      <SimpleGrid spacing={4} minChildWidth={350} mb={12}>
        <Heading>All Videos</Heading>
        <VideoCardGrid videos={[]} />
      </SimpleGrid>
    </section>
  );
}
