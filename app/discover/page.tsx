import { fetchAllAssets } from '@app/lib/utils/actions/livepeer';
import {
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Flex,
  Heading,
  Text,
} from '@chakra-ui/react';

const AllVideosPage = async () => {
  const assets = await fetchAllAssets();
  console.log(assets);

  return (
    <main>
      <Box my={10} p={4}>
        <Breadcrumb>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">
              <span role="img" aria-label="home">
                🏠
              </span>{' '}
              Home
            </BreadcrumbLink>
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
          {/* <VideoCardGrid  assets={assets} />  */}
          <button ></button>
        </Flex>
      </Box>
    </main>
  );
};
export default AllVideosPage;
