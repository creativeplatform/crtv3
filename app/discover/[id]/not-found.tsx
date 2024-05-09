import React from 'react';
import { Box, Flex, Heading, Text } from '@chakra-ui/react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <Box>
      <Heading as={'h2'}>Not Found</Heading>
      <Flex>
        <Text>Could not find requested resource</Text>
        <Link href="/">Return Home</Link>
      </Flex>
    </Box>
  );
}
