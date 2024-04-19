"use client";
import React from "react";
import {
  Flex,
  Heading,
  VStack,
  Stack,
  Box,
  Grid,
  Text,
  BreadcrumbItem, 
  BreadcrumbLink, 
  Breadcrumb,
} from "@chakra-ui/react";
import PricingBox from "../../../components/Pricing/PricingBox";
import { CURRENT_PRICES } from "../../../utils/context";

const prices = CURRENT_PRICES;

const Pricing = () => (
  <main>
    <Box my={10} p={4}>
        <Breadcrumb>
            <BreadcrumbItem>
                <BreadcrumbLink href='/'><span role="img" aria-label="home">🏠</span> Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem isCurrentPage>
                <BreadcrumbLink>Membership Price</BreadcrumbLink>
            </BreadcrumbItem>
        </Breadcrumb>
    </Box>
    <Flex
      direction="column"
      alignItems="center"
      justifyContent="center"
      minH="100vh"
      w="full"
      backgroundColor="gray.200"
    >
      <Stack
        spacing={5}
        marginY={5}
        justifyContent="flex-start"
        alignItems="center"
        maxWidth="1200px"
        w="full"
        paddingX={[5, 0]}
      >
        <VStack alignItems="center" w="full">
          <Heading color="teal.300">Pricing</Heading>
          <Text mb={5} textAlign="center">
            Neque porro quisquam est qui dolorem ipsum quia dolor sit amet
          </Text>
        </VStack>
        <Stack
          spacing={0}
          border="1px solid"
          borderColor="teal.300"
          borderRadius="4px"
          justifyContent="center"
          alignItems="stretch"
          display="flex"
          width="fit-content"
          backgroundColor="white"
          mb={3}
        >
          <Box backgroundColor="teal.300" color="white" p=".3rem 1rem">
            Monthly
          </Box>
          <Box p=".3rem 1rem">Annually</Box>
        </Stack>
        <Grid
          w="full"
          gap={5}
          justifyContent="center"
          templateColumns={{
            base: "inherit",
            md: "repeat( auto-fit, 250px )"
          }}
        >
          {prices.map((price) => (
            <PricingBox key={price.name} {...price} />
          ))}
        </Grid>
      </Stack>
    </Flex>
  </main>
);

export default Pricing;
