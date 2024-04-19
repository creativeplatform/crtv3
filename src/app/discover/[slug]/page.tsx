import React from'react';
import { Text, Heading, Box } from '@chakra-ui/react';

export default function VideoDetailsPage({ params }: { params: { slug: string } }) {
  return (
  <main>
    <Heading p={4}>Video Detail Page</Heading>
    <Box>
        {params.slug}
    </Box>
  </main>
  );
}