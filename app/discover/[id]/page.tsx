import { deleteAsset, fetchAssetId } from '@app/lib/utils/actions/livepeer';
import { Container } from '@chakra-ui/react';

export type VideoDetailsProps = {
  params: { id: string };
};
export default async function VideoDetailsPage({ params }: VideoDetailsProps) {
  const asset = await fetchAssetId(params.id);
  console.log('asset; ', asset);

  return (
    <Container maxW="7xl" centerContent>
      {/* <Box py={10}>{<VideoDetails asset={asset} />}</Box> */}
    </Container>
  );
}
