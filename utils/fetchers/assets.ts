import { Component } from 'react'
import livepeer from '../../src/app/livepeer'

export type AssetData = {
  assetId: string | null
  user: string
  title: string
  description: string
  video: Video
  views: Views
}

export type Video = {
  assetId?: string | null
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
  assetId?: string | null
  playbackId: string
  publicViews: any
}

export const getAllAssets = async () => {
  const response = await livepeer?.asset.getAll()
  const assets = response

  console.log('Assets: ', assets)
  return [assets]
}

export const fetchAssetId = async (id: string | { queryKey: [unknown, { assetId: string }] })  => {
  let assetId: string;

  if (typeof id === 'string') {
    // Handle the case where `id` is a string
    assetId = id;
  } else {
    // Handle the case where `id` is an object with a `queryKey` property
    const [, { assetId: queryAssetId }] = id.queryKey;
    assetId = queryAssetId;
  }

  console.log('Fetching asset...');
  const response = await livepeer?.asset?.get(assetId);
  const asset = response;

  console.log('Asset: ', asset);
  return asset;
}

export const updateAsset = async (id: string | { queryKey: [unknown, { assetId: string }] }, data: any) => {
  let assetId: string;

  if (typeof id === 'string') {
    // Handle the case where `id` is a string
    assetId = id;
  } else {
    // Handle the case where `id` is an object with a `queryKey` property
    const [, { assetId: queryAssetId }] = id.queryKey;
    assetId = queryAssetId;
  }

  console.log('Updating asset...')
  const response = await livepeer?.asset?.update(assetId, data)
  const asset = response

  console.log('Updated: ', asset)
  return asset
}

export const deleteAsset = async (id: string | { queryKey: [unknown, { assetId: string }] }, data: any) => {
  let assetId: string;

  if (typeof id === 'string') {
    // Handle the case where `id` is a string
    assetId = id;
  } else {
    // Handle the case where `id` is an object with a `queryKey` property
    const [, { assetId: queryAssetId }] = id.queryKey;
    assetId = queryAssetId;
  }

  console.log('Deleting asset...')
  const response = await livepeer?.asset?.delete(assetId, data)
  const asset = response

  console.log('Deleted: ', asset)
  return asset
}

export const createViaUrl = async (data: any, config: any) => {
  try {
  console.log('Creating URL...')
  const response = await livepeer?.asset?.createViaURL(data, config)
  const asset = response;
    console.log('Created: ', asset);
    return [asset];
  } catch (error) {
    console.error('Error creating url:', error);
  }
}

export const createAsset = async (data: any, config: any) => {
  try {
  console.log('Creating asset...')
  const response = await livepeer?.asset?.create(data, config)
  const asset = response;
    console.log('Created: ', asset);
    return [asset]; 
  } catch (error) {
    console.error('Error creating asset:', error);
  }
}