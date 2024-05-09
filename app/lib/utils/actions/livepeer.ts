'use server';

import { livepeer } from '@app/lib/sdk/livepeer/client';

// FETCH ALL ASSETS
export const fetchAllAssets = async () => {
  console.log('Fetching assets...');
  // const response = await livepeer?.asset.getAll();
  // console.log('Assets: ', response);
  // return response;

  return await livepeer.getAll();
};

// FETCH ASSET BY ID
export const fetchAssetId = async (
  id: string,
  // id: string | { queryKey: [unknown, { assetId: string }] },
) => {
  let assetId: string;

  // if (typeof id === 'string') {
  // Handle the case where `id` is a string
  //   assetId = id;
  // } else {
  // Handle the case where `id` is an object with a `queryKey` property
  // const [, { assetId: queryAssetId }] = id.queryKey;
  // assetId = queryAssetId;
  // }

  console.log('Fetching asset by id...');
  //   const response = await livepeer?.asset.get(assetId);
  //   const asset = response;

  const asset = await livepeer.getById(id);
  return asset;
};

// UPDATE ASSET BY ID
export const updateAsset = async (
  id: string | { queryKey: [unknown, { assetId: string }] },
  data: any,
) => {
  let assetId: string;
  // if (typeof id === 'string') {
  // Handle the case where `id` is a string
  // assetId = id;
  // } else {
  // Handle the case where `id` is an object with a `queryKey` property
  // const [, { assetId: queryAssetId }] = id.queryKey;
  // assetId = queryAssetId;
  // }

  console.log('Updating asset...');
  //   const response = await livepeer?.asset.update(assetId, data);
  //   const asset = response;

  //   console.log('Updated: ', asset);
  //   return asset;
};

// CREATE ASSET
export const createAsset = async (data: any) => {
  try {
    console.log('Creating asset...');
    // const response = await livepeer?.asset.create(data);
    // const asset = response;
    // console.log('Created: ', asset);
    // return [asset];
  } catch (error) {
    console.error('Error creating asset:', error);
  }
};

// CREATE ASSET VIA URL
export const createViaUrl = async (data: any, config: any) => {
  try {
    console.log('Creating URL...');
    // const response = await livepeer?.asset?.createViaUrl(data);
    // const asset = response;
    // console.log('Created: ', asset);
    // return [asset];
  } catch (error) {
    console.error('Error creating url:', error);
  }
};

// DELETE ASSET BY ID
export const deleteAsset = async (
  id: string | { queryKey: [unknown, { assetId: string }] },
) => {
  let assetId: string;
  if (typeof id === 'object') {
    // Handle the case where `id` is an object with a `queryKey` property
    const [, { assetId: queryAssetId }] = id.queryKey;
    assetId = queryAssetId;
  } else {
    // Handle the case where `id` is a string
    assetId = id;
  }
  console.log('Deleting asset...');
  //   const response = await livepeer?.asset.delete(assetId);
  //   const asset = response;
  //   console.log('Deleted: ', asset);
  //   return asset;

  const res = await livepeer.deleteById(assetId);
  return res;
};
