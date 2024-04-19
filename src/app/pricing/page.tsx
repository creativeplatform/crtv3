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
  useColorModeValue,
} from "@chakra-ui/react";
import PricingBox from "../../../components/Pricing/PricingBox";
import { CURRENT_PRICES } from "../../../utils/context";

const prices = CURRENT_PRICES;

const Pricing = () => (
  <main>
    <Box my={5} p={4}>
        <Breadcrumb>
            <BreadcrumbItem>
                <BreadcrumbLink href='/'><span role="img" aria-label="home">🏠</span> Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem isCurrentPage>
                <BreadcrumbLink>Membership Pricing</BreadcrumbLink>
            </BreadcrumbItem>
        </Breadcrumb>
    </Box>
    <Flex
      direction="column"
      alignItems="center"
      justifyContent="center"
      minH="50vh"
      w="full"
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
          <Heading color="#EC407A">Pricing</Heading>
          <Text mb={5} textAlign="center">
            Choose the path that best suits your creative journey with our tailored membership plans. Whether you&apos;re here to explore, create, support, or expand your business, we&apos;ve got the tools and perks to enhance your experience. Unlock a world of possibilities and take the next step towards shaping the future of entertainment. Select a plan that resonates with your aspirations and join the revolution of empowered creatives.
          </Text>
        </VStack>
        <Stack
          spacing={0}
          border="1px solid"
          borderColor="#EC407A"
          borderRadius="4px"
          justifyContent="center"
          alignItems="stretch"
          display="flex"
          width="fit-content"
          backgroundColor={useColorModeValue("inherit","#1a202C")}
          mb={3}
        >
          <Box backgroundColor="#EC407A" color={'white'} p=".3rem 1rem">
            <Text>
              Monthly
            </Text>
          </Box>
          <Box p=".3rem 1rem">
            <Text>Annually</Text>
          </Box>
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
