import { useQuery } from '@tanstack/react-query'
import { Box, SimpleGrid } from '@chakra-ui/react'
import { LivepeerConfig } from '@livepeer/react'
import { useAddress } from '@thirdweb-dev/react'
import { useLivepeerClient } from 'hooks/useLivepeerClient'
import { AssetData } from 'utils/fetchers/assets'
import VideoCard from './VideoCard'
// import { Discussion } from "@orbisclub/components";
// import "@orbisclub/components/dist/index.modern.css";

type ApiResponse<TData> = { data?: TData; errors?: any[] }

export default function AllAssets() {

  const address = useAddress()
  const videosQuery = useQuery<ApiResponse<AssetData['video'][]>>(['allVideos'], () => fetch('/api/livepeer/assets').then((res) => res.json()), {
    staleTime: 3000,
  })

  if (videosQuery.isLoading) {
    console.log('loading...')
    // loading state
    return <Box mb={24}>Loading...</Box>
  }

  if (videosQuery?.isError || videosQuery?.data.errors) {
    console.log('error', videosQuery?.error)
    return <Box children="Error loading resource." mb={24} />
  }

  const readyVideos =
    videosQuery?.data?.data?.filter((video): video is AssetData['video'] => {
      return (
        video?.status?.phase === 'ready'
        //Number(video?.storage?.ipfs?.spec?.nftMetadata?.properties?.pricePerNFT) > 0
      )
    }) ?? []

  return (
    <LivepeerConfig client={useLivepeerClient}>
      <SimpleGrid spacing={4} minChildWidth={350} mb={12}>
        {readyVideos.map((video) => {
          return <VideoCard key={video.id} video={video} />
        })}
      </SimpleGrid>
    </LivepeerConfig>
  )
}