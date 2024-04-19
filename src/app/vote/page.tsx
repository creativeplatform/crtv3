import React from 'react'
import { BreadcrumbItem, BreadcrumbLink, Breadcrumb, Box, Heading, Flex, Text } from '@chakra-ui/react'
import Link from 'next/link'

export default function Vote() {
    return (
      <main>
          <Box my={5} p={4}>
              <Breadcrumb>
                  <BreadcrumbItem>
                      <BreadcrumbLink href='/'><span role="img" aria-label="home">🏠</span> Home</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbItem isCurrentPage>
                      <BreadcrumbLink href='#'>Vote</BreadcrumbLink>
                  </BreadcrumbItem>
              </Breadcrumb>
          </Box>
          <Box>
            <Heading mb={10}>Vote</Heading>
            <Flex flexDirection="column" my={10} gap={5} maxW="md">
              <Text>This is the Voting Page.</Text>
              <Box>
                <Link href="/vote/create">Create a Proposal</Link>
              </Box>
              <Box>
                <Link href="/vote/more">More Options</Link>
              </Box>
            </Flex>
          </Box>
      </main>
    );
}