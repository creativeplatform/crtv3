import React from "react";
import {
    Box,
    Stack,
    HStack,
    Text,
    Heading,
    Divider,
    List,
    ListIcon,
    ListItem,
    Button,
    useColorModeValue,
} from "@chakra-ui/react";
import { ArrowForwardIcon, CheckCircleIcon } from "@chakra-ui/icons";
import Link from "next/link";

// Define an interface for the props
interface PricingBoxProps {
    name: string;
    popular?: boolean;
    price?: string;
    info?: string;
    features: string[];
    url: string;
}

const PricingBoxA: React.FC<PricingBoxProps> = ({ popular = false, name, price, info = "", features, url }) => {
    const listItemColor = useColorModeValue("gray.600", "white");
    return (
        <Stack
            spacing={2}
            border="3px solid"
            borderColor={popular ? "#EC407A" : "gray.300"}
            borderRadius="0.7rem"
            p={4}
            h="350px"
            backgroundColor={useColorModeValue("whitesmoke","#161D2F")}
            position="relative"
        >
            {popular && (
                <Box
                    position="absolute"
                    top="0"
                    right="0"
                    backgroundColor="#EC407A"
                    color="white"
                    paddingX={2}
                    paddingY={1}
                    borderRadius="0 0 0 0.7rem"
                    fontSize="0.8rem"
                >
                    POPULAR
                </Box>
            )}
            <Text color={ useColorModeValue('gray.600','white')} textTransform="uppercase">{name}</Text>
            <HStack>
                <Heading color={useColorModeValue('gray.600','white')}>{price ?? "Free"}</Heading>
                {price && (
                    <Box as="span">
                        <Text color={"gray.600"} fontSize={'small'} >
                            / 3 mo
                        </Text>
                    </Box>
                )}
            </HStack>
            <Divider borderColor="blackAlpha.500" />
            <List flex="1">
                {features.map((feat, index) => (
                    <ListItem key={index} color={listItemColor}>
                        <ListIcon as={CheckCircleIcon} color="gray.400" />
                        {feat}
                    </ListItem>
                ))}
            </List>
            <Box>
                <Link href={url} target={"blank"}>
                    <Button
                        variant="solid"
                        size="sm"
                        width="100%"
                        rightIcon={<ArrowForwardIcon />}
                        borderRadius={0}
                        display="flex"
                        justifyContent="space-between"
                        backgroundColor={popular ? "#EC407A" : "gray.400"}
                        _hover={{
                            backgroundColor: popular ? "#EC407A" : "gray.300"
                        }}
                        color="white"
                    >
                        Buy
                    </Button>
                </Link>
                <Text color={useColorModeValue('gray.600','white')} fontSize="xs">{info}</Text>
            </Box>
        </Stack>
    );
};

export default PricingBoxA;