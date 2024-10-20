'use server';

import { fullLivepeer } from '@app/lib/sdk/livepeer/fullClient';
import {
  Asset,
  NewAssetFromUrlPayload,
  NewAssetPayload,
} from 'livepeer/models/components';

// FETCH ALL ASSETS
export const fetchAllAssets = async (): Promise<Asset[] | {}> => {
  try {
    console.log('Fetching assets...');
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_THIRDWEB_AUTH_DOMAIN}/api/livepeer`,
    );
    const json = await response.json();
    console.log('Assets: ', json);
    return json;
  } catch (error) {
    console.error('Error fetching assets:', error);
    return {};
  }
};

// FETCH ASSET BY ID
export const fetchAssetId = async (
  id: string | { queryKey: [unknown, { assetId: string }] },
) => {
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
  const response = await fullLivepeer?.asset.get(assetId);
  const asset = response;

  console.log('Asset: ', asset);
  return asset;
};

// UPDATE ASSET BY ID
export const updateAsset = async (
  id: string | { queryKey: [unknown, { assetId: string }] },
  data: any,
) => {
  let assetId: string;

  if (typeof id === 'string') {
    // Handle the case where `id` is a string
    assetId = id;
  } else {
    // Handle the case where `id` is an object with a `queryKey` property
    const [, { assetId: queryAssetId }] = id.queryKey;
    assetId = queryAssetId;
  }

  console.log('Updating asset...');
  const response = await fullLivepeer?.asset.update(assetId, data);
  const asset = response;

  console.log('Updated: ', asset);
  return asset;
};

// CREATE ASSET
export const createAsset = async (data: NewAssetPayload) => {
  try {
    console.log('Creating asset...');
    const response = await fullLivepeer?.asset.create(data);
    const asset = response;
    console.log('Created: ', asset);
    return [asset];
  } catch (error) {
    console.error('Error creating asset:', error);
  }
};

// CREATE ASSET VIA URL
export const createViaUrl = async (data: NewAssetFromUrlPayload) => {
  try {
    console.log('Creating URL...');
    const response = await fullLivepeer?.asset?.createViaUrl(data);
    const asset = response;
    console.log('Created: ', asset);
    return [asset];
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
  const response = await fullLivepeer?.asset.delete(assetId);
  const asset = response;
  console.log('Deleted: ', asset);
  return asset;
};
