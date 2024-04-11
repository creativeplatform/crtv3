import { Flex, Link, Text, VStack } from '@chakra-ui/react';
import { ConnectButton } from "@/app/thirdweb";
import { sepolia } from "thirdweb/chains";
import { client } from "@/app/client";
import { ACCOUNT_FACTORY_ADDRESS } from "../../../utils/context";
// import Link from 'next/link';

const NonLoggedInView = () => {

  return (
    <Flex
      direction={'column'}
      alignItems="flex-start"
      maxW="454px"
      gap={5}
      mx="40px"
    >
      <Text fontSize="3xl">Creative TV</Text>
      <Text fontSize="lg">
        Collab.Land offers a token gating feature that allows you to restrict
        access to elements or pages of your site based on ownership of certain
        blockchain assets.
      </Text>
      <Text fontSize="lg">
        The&nbsp;
        <Link
          className="underline"
          href="https://www.npmjs.com/package/collabland-tokengate-react-context"
          target="_blank"
        >
          collabland-tokengate-react-context
        </Link>{' '}
        is a package that provides a React context for token gating users based
        on specific rules. It utilizes the Collab.Land APIs to implement this
        functionality
      </Text>
      <VStack alignItems="flex-start" gap={0}>
        <Link
          className="underline"
          href="https://www.npmjs.com/package/collabland-tokengate-react-context"
          target="_blank"
        >
          Token Gate React Context
        </Link>
        <Link
          className="underline"
          href="https://docs.collab.land/help-docs/key-features/token-gate-communities/"
          target="_blank"
        >
          Collab.Land Token-Gate Docs
        </Link>
      </VStack>
      <ConnectButton
            client={client}
            chain={sepolia}
            connectButton={{
              label: "Get Started",
              className: "my-custom-class",
              style: {
                borderRadius: "10px",
              },
            }}
            accountAbstraction={{
              factoryAddress: ACCOUNT_FACTORY_ADDRESS.sepolia,
              chain: sepolia,
              gasless: true,
            }}
            appMetadata={{
              name: "Creative TV",
              url: "https://tv.creativeplatform.xyz",
            }}
          />
    </Flex>
  );
};

export default NonLoggedInView;