"use client";
import React from 'react';
import { BreadcrumbItem, BreadcrumbLink, Breadcrumb, Box, Heading, Flex, Text } from '@chakra-ui/react';
import Link from 'next/link';
import AllAssets from '../../../components/Videos/AllAssets';

const AllVideosPage =() => {
  return (
    <main>
      <Box my={10} p={4}>
        <Breadcrumb>
          <BreadcrumbItem>
            <BreadcrumbLink href='/'><span role="img" aria-label="home">🏠</span> Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>
            <BreadcrumbLink>Discover</BreadcrumbLink>
          </BreadcrumbItem>
        </Breadcrumb>
      </Box>
      <Box>
      <Heading mb={10}>Discover Content</Heading>
        <Flex flexDirection="column" my={10} gap={5} maxW="md">
          <Text>This is the Discover page.</Text>
          <AllAssets />
        </Flex>
      </Box>
    </main>
  )
}
export default AllVideosPage;