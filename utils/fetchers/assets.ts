import livepeer from '../../src/app/livepeer'

export type AssetData = {
  id: any
  user: string
  title: string
  description: string
  video: Video
  views: Views
}

export type Video = {
  id?: any | null
  name: string
  status: { phase: string | null; updatedAt: bigint; progress: string | null; errorMessage: string | null }
  playbackId: string
  creatorId: { [index: string]: string }
  storage: {
    ipfs: {
      cid: string
      gateway: string
      url: string
      nftMetadata: {
        cid: string
        gateway: string
        url: string
      }
      spec: {
        nftMetadata: {
          description: string
          image: string
          properties: {
            [idx: string]: any
            nFTAmountToMint: number | string
            pricePerNFT: number | string
          }
        }
      }
    }
  }
  transcodingStatus: string
  createdAt: bigint
  updatedAt: bigint
  downloadUrl?: string
  viewCount: number
}

export type Views = {
  [x: string]: any
  id?: any | null
  playbackId: string
  publicViews: any
}

export const getAllAssets = async () => {
  const response = await livepeer?.asset.getAll()
  const assets = response

  console.log('Assets: ', assets)
  return [assets]
}

export const fetchAssetId = async (id: any) => {
  const [, { assetId }] = id.queryKey
  console.log('Fetching asset...')
  const response = await livepeer?.asset?.get(assetId)
  const asset = response

  console.log('Asset: ', asset)
  return [asset]
}

export const updateAsset = async (id: any, data: any) => {
  const [, { assetId }] = id.queryKey
  console.log('Updating asset')
  const response = await livepeer?.asset?.update(assetId, data)
  const asset = response

  console.log('Asset: ', asset)
  return [asset]
}