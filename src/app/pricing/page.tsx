"use client";
import React, { useState } from "react";
import {
  Flex,
  Heading,
  VStack,
  Stack,
  Box,
  Button,
  Grid,
  Text,
  BreadcrumbItem, 
  BreadcrumbLink, 
  Breadcrumb,
  useColorModeValue,
} from "@chakra-ui/react";
import PricingBoxA from "../../../components/Pricing/PricingBoxA";
import PricingBoxB from "../../../components/Pricing/PricingBoxB";
import { QUARTERLY_PRICES, ANNUAL_PRICES } from "../../../utils/context";

const aPrices = QUARTERLY_PRICES;
const bPrices = ANNUAL_PRICES;

const Pricing = () => {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
  <main>
    <Box my={5} p={4}>
        <Breadcrumb>
            <BreadcrumbItem>
                <BreadcrumbLink href='/'><span role="img" aria-label="home">🏠</span> Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem isCurrentPage>
                <BreadcrumbLink href='#'>Membership Pricing</BreadcrumbLink>
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
          borderRadius="6px"
          justifyContent="center"
          alignItems="stretch"
          display="flex"
          width="fit-content"
          backgroundColor={useColorModeValue("inherit","#1a202C")}
          mb={3}
        >
          <Box as={Button} backgroundColor={!isAnnual ? "#EC407A" : "inherit"} color={!isAnnual ? 'white' : 'inherit'} _hover={{color: "inherit"}} p=".3rem 1rem" onClick={() => setIsAnnual(false)}>
            <Text>
              Quarterly
            </Text>
          </Box>
          <Box as={Button} backgroundColor={isAnnual ? "#EC407A" : "inherit"} color={isAnnual ? 'white' : 'inherit'} _hover={{color: "inherit"}} p=".3rem 1rem" onClick={() => setIsAnnual(true)}>
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
          {!isAnnual
            ? aPrices.map((price) => (<PricingBoxA key={price.name} {...price} />))
            : bPrices.map((price) => (<PricingBoxB key={price.name} {...price} />))
          }
        </Grid>
      </Stack>
    </Flex>
  </main>
  );
};

export default Pricing;
