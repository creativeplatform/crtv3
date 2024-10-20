'use client';
import { fullLivepeer } from '@app/lib/sdk/livepeer/fullClient';
import Image from 'next/image';
import React, { useState, useRef, useEffect } from 'react';
import { BiCloud, BiMusic, BiPlus } from 'react-icons/bi';
import {
  NewAssetFromUrlPayload,
  NewAssetPayload,
} from 'livepeer/models/components';
import { useActiveAccount } from 'thirdweb/react';
import { client } from '@app/lib/sdk/thirdweb/client';
import {
  Type,
  TranscodeProfileProfile,
  TranscodeProfileEncoder,
} from 'livepeer/models/components';
import {
  AssetData,
  AssetType,
  CreatorIdType,
  PlaybackPolicyType,
  SourceType,
} from '@app/lib/types';
import { polygon } from 'thirdweb/chains';
import { upload } from 'thirdweb/storage';
import {
  deploySplitContract,
  prepareDeterministicDeployTransaction,
  deployERC1155Contract,
} from 'thirdweb/deploys';
import { ACCOUNT_FACTORY_ADDRESS } from '@app/lib/utils/context';
import { toast } from 'sonner'; // Add this import for error notifications
import FileUpload from './FileUpload';
import PreviewVideo from './PreviewVideo';
import { createAsset, createViaUrl } from '@app/api/livepeer/actions'; // Import the createAsset function

export default function Upload() {
  // Creating state for the input field
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [thumbnail, setThumbnail] = useState<File | string>('');
  const [video, setVideo] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [assetData, setAssetData] = useState<AssetData>({
    name: '',
    description: '',
    id: '',
  });
  const [videoUrl, setVideoUrl] = useState<string>(''); // Add this line to define videoUrl state

  //  Creating a ref for thumbnail and video
  const thumbnailRef = useRef();
  const videoRef = useRef<HTMLInputElement | null>(null); // Create a ref for the video input

  const chain = polygon;
  const activeAccount = useActiveAccount();
  const goBack = () => {
    window.history.back();
  };

  const uploadVideo = async (payload: NewAssetFromUrlPayload) => {
    const response = await fetch(payload.url, {
      method: 'Post',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Failed to upload video');
    }

    return response.url; // This should return the URL of the uploaded video
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      // Step 1: Request the upload URL
      // const uploadData = fullLivepeer.asset;
      // const uploadUrlResponse = await uploadData.createViaUrl({
      //   // Await the promise to get the actual upload URL
      //   name: videoFile?.name || '',
      //   staticMp4: true,
      //   playbackPolicy: {
      //     type: Type.Webhook,
      //     webhookId: '1bde4o2i6xycudoy',
      //     webhookContext: {
      //       streamerId: 'my-custom-id',
      //     },
      //     refreshInterval: 600,
      //   },
      //   url: videoUrl,
      //   profiles: [
      //     {
      //       width: 1280,
      //       name: '720p',
      //       height: 720,
      //       bitrate: 3000000,
      //       quality: 23,
      //       fps: 30,
      //       fpsDen: 1,
      //       gop: '2',
      //       profile: TranscodeProfileProfile.H264Baseline,
      //       encoder: TranscodeProfileEncoder.H264,
      //     },
      //   ],
      // });

      // const uploadUrlResponse = createViaUrl({
      //   name: videoFile?.name || '',
      //   url: videoUrl,
      // });

      if (videoFile && videoUrl) {
        // Check if videoFile is not null
        const uploadedVideoUrl = await uploadVideo({
          name: title,
          url: videoUrl,
        });
        setVideoUrl(uploadedVideoUrl);

        // Step 3: Create the asset using the createAsset function
        const assetData = {
          name: title,
          description,
          video: videoFile, // Use the URL of the uploaded video
          // Add other necessary fields based on your Asset type
        };

        console.log('Video url', videoUrl);
        // const createdAsset = await createLivepeerAsset(assetData);
        // console.log('Created asset:', createdAsset);

        // Handle successful submission
        toast.success('Video uploaded and asset created successfully!');
      } else {
        throw new Error('No video file selected'); // Handle the case where videoFile is null
      }
    } catch (error) {
      console.error('Error submitting video:', error);
      toast.error('Failed to upload video. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateForm = () => {
    if (!title.trim()) {
      toast.error('Please enter a title');
      return false;
    }
    if (!description.trim()) {
      toast.error('Please enter a description');
      return false;
    }
    if (!videoFile && !videoUrl) {
      // Change this line
      toast.error('Please upload a video');
      return false;
    }
    // Add more validation as needed
    return true;
  };

  const getSplits = async (collabs: string[], shares: bigint[]) => {
    const splits = await deploySplitContract({
      chain: chain,
      client,
      account: activeAccount,
      params: {
        name: 'Split Contract',
        payees: [activeAccount?.address, ...collabs],
        shares: [1000n, ...shares],
      },
    });
    console.log('splits', splits);
    return splits;
  };

  const determineVideoAddress = async () => {
    const tx = prepareDeterministicDeployTransaction({
      client,
      chain: chain,
      contractId: ACCOUNT_FACTORY_ADDRESS.polygon,
      constructorParams: [],
    });
    console.log('tx', tx);
    return tx;
  };

  const generateVideoNFT = async (
    description: string,
    name: string,
    image: string,
  ) => {
    const videoNFT = await deployERC1155Contract({
      chain: chain,
      client: client,
      account: activeAccount,
      type: 'DropERC1155',
      params: {
        name: name,
        image: image,
        description: description,
        symbol: 'CRTVV',
      },
    });
    console.log('videoNFT', videoNFT);
    return videoNFT;
  };

  const handleCancelVideo = () => {
    setVideoFile(null); // Clear the video file
    setVideoUrl(''); // Clear the video URL
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-4 flex justify-end">
        <div className="flex items-center">
          <button
            className="mr-4 rounded-lg border border-[#EC407A] bg-transparent px-4 py-2 text-[#EC407A] hover:border-[#A6335A] hover:text-[#A6335A] focus:border-[#A6335A] focus:text-[#A6335A]"
            onClick={goBack}
          >
            Discard
          </button>
          <button
            onClick={handleSubmit}
            disabled={isUploading || isSubmitting}
            className="flex items-center rounded-lg bg-[#EC407A] px-4 py-2 text-white hover:bg-[#A6335A] focus:bg-[#A6335A] disabled:opacity-50"
          >
            {isSubmitting ? (
              'Uploading...'
            ) : (
              <>
                <BiCloud className="mr-2" />
                Upload
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        <div className="flex w-full flex-col p-4 lg:w-1/2">
          <label htmlFor="title" className="text-sm">
            Title
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Rick Astley - Never Gonna Give You Up (Official Music Video)"
            className="mt-2 h-12 w-full rounded-md border border-[#444752] p-2 text-gray-600 placeholder:text-gray-400 focus:outline-none"
            required
          />
          <label className="mt-10">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Never Gonna Give You Up was a global smash on its release in July 1987, topping the charts in 25 countries including Rick's native UK and the US Billboard Hot 100.  It also won the Brit Award for Best single in 1988. Stock Aitken and Waterman wrote and produced the track which was the lead-off single and lead track from Rick's debut LP "
            className="mt-2 h-32 w-full rounded-md border border-[#444752] p-2 text-gray-600 placeholder:text-gray-400 focus:outline-none"
          />

          <div className="mt-10 flex w-full flex-col justify-between lg:flex-row">
            <div className="mb-4 flex w-full flex-col lg:mb-0 lg:w-2/5">
              <label className="text-sm">Location</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                type="text"
                placeholder="New York - United States"
                className="mt-2 h-12 w-full rounded-md border border-[#444752] p-2 text-gray-600 placeholder:text-gray-400 focus:outline-none"
              />
            </div>
            <div className="flex w-full flex-col lg:w-2/5">
              <label className="text-sm">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-2 h-12 w-full rounded-md border border-[#444752] p-2 text-gray-600 placeholder:text-gray-400 focus:outline-none"
              >
                <option>Music</option>
                <option>Sports</option>
                <option>Gaming</option>
                <option>News</option>
                <option>Entertainment</option>
                <option>Education</option>
                <option>Science & Technology</option>
                <option>Travel</option>
                <option>Other</option>
              </select>
            </div>
          </div>
          <label className="mt-10 text-sm">Thumbnail</label>

          <div
            onClick={() => {
              thumbnailRef?.current;
            }}
            className="mt-2 flex h-36 w-64 items-center justify-center rounded-md border-2 border-dashed border-gray-600 p-2"
          >
            {thumbnail ? (
              <Image
                onClick={() => {
                  thumbnailRef?.current;
                }}
                src={''}
                alt="thumbnail"
                className="h-full rounded-md"
              />
            ) : (
              <BiPlus size={40} />
            )}
          </div>

          <input
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e?.target?.files ? e.target.files[0] : null;
              if (file) {
                setThumbnail(file);
                //Upload to IPFS
                upload({
                  client,
                  files: [
                    {
                      name: 'thumbnail',
                      data: file,
                      type: 'image/png',
                    },
                  ],
                });
              }
            }}
          />
        </div>

        <div className="mx-auto flex w-full flex-col items-center justify-center pl-4 lg:w-1/2">
          <div
            onClick={() => {
              videoRef?.current;
            }}
            className={`flex h-auto w-full items-center justify-center rounded-md ${videoFile ? '' : 'border-2 border-dashed border-gray-600'}`}
          >
            {/* hide element once videoUrl is available */}
            <div className="">
              <FileUpload
                onFileSelect={(file) => {
                  console.log('Selected file:', file); // Debugging line
                  setVideoFile(file);
                }}
                onFileUploaded={(videoUrl: string) => {
                  console.log('Uploaded video URL:', videoUrl); // Debugging line
                  setVideoUrl(videoUrl);
                }}
              />
            </div>
          </div>
          {videoFile && <PreviewVideo video={videoFile} />}
        </div>
      </div>

      <input
        type="file"
        className="hidden"
        accept="video/*"
        ref={videoRef}
        onChange={(e) => {
          const file = e.target.files?.[0] || null;
          if (file) {
            console.log('Selected video file:', file); // Debugging line
            setVideoFile(file);
          }
        }}
      />
    </div>
  );
}
