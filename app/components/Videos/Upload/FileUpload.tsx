'use client';
import React, { useState } from 'react';
import { toast } from 'sonner';
import { CopyIcon } from 'lucide-react';
import { getLivepeerUploadUrl } from '@app/api/livepeer/livepeerActions';
import * as tus from 'tus-js-client';
import PreviewVideo from './PreviewVideo';
import { useActiveAccount } from 'thirdweb/react';
import { Progress } from '@app/components/ui/progress';
import { Button } from '@app/components/ui/button';
import {
  Subtitles,
  Chunk,
} from '../../../lib/sdk/orbisDB/models/AssetMetadata';
import JsGoogleTranslateFree from '@kreisler/js-google-translate-free';
import { getLivepeerAudioToText } from '@app/api/livepeer/audioToText';
import { upload } from 'thirdweb/storage';
import { client } from '@app/lib/sdk/thirdweb/client';
import Link from 'next/link';

const truncateUri = (uri: string): string => {
  if (uri.length <= 30) return uri;
  return uri.slice(0, 15) + '...' + uri.slice(-15);
};

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text).then(() => {
    toast('IPFS URI Copied!');
  });
};

interface FileUploadProps {
  onFileSelect: (file: File | null) => void;
  onFileUploaded: (fileUrl: string) => void;
  onSubtitlesUploaded: (subtitlesUri?: string) => void;
  onPressNext?: (livepeerAsset: any) => void;
  onPressBack?: () => void;
  metadata?: any;
  newAssetTitle?: string;
}

const translateText = async (
  text: string,
  language: string,
): Promise<string> => {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_THIRDWEB_AUTH_DOMAIN || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/livepeer/subtitles/translation`, {
      method: 'POST',
      body: JSON.stringify({
        text: text,
        source: 'English',
        target: language,
      }),
    });

    const data = await res.json();

    console.log('Translation response:', data);

    return data.response;
  } catch (error) {
    console.error('Translation error:', error);
    return text; // Fallback to original text if translation fails
  }
};

async function translateSubtitles(data: {
  chunks: Chunk[];
}): Promise<Subtitles> {
  const subtitles: Subtitles = {
    English: data.chunks,
  };

  const languages = ['Chinese', 'German', 'Spanish'];

  // Create a single Promise.all for all language translations to reduce nested mapping
  const translationPromises = languages.map(async (language) => {
    try {
      // Skip translation for English
      if (language === 'English') return null;
      console.log('Translating to:', language);
      // Perform translations concurrently for each chunk
      const translatedChunks = await Promise.all(
        data.chunks.map(async (chunk, i) => {
          const to =
            language === 'Chinese' ? 'zh' : language === 'German' ? 'de' : 'es';
          const translation = await JsGoogleTranslateFree.translate({
            to,
            text: chunk.text,
          }); // a
          const arr = {
            text: translation,
            timestamp: chunk.timestamp,
          };
          console.log('Translated chunk ' + i + ':', arr);
          return arr;
        }),
      );

      console.log('Translated chunks:', translatedChunks);

      return { [language]: translatedChunks };
    } catch (error) {
      console.error('Error translating subtitles:', error);
      return {};
    }
  });

  // Filter out null results and combine translations
  const translations = await Promise.all(translationPromises);
  const languageTranslations = translations.filter(Boolean);

  console.log('translations:', translations);
  console.log('Language translations:', languageTranslations);

  // Merge translations efficiently
  return languageTranslations
    .filter(
      (translation): translation is { [key: string]: Chunk[] } =>
        translation !== null,
    )
    .reduce(
      (acc, curr) => ({
        ...acc,
        ...curr,
      }),
      subtitles,
    );
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  onFileUploaded,
  onSubtitlesUploaded,
  onPressNext,
  onPressBack,
  metadata,
  newAssetTitle,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadedUri, setUploadedUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [uploadComplete, setUploadComplete] = useState<boolean>(false);
  const [uploadState, setUploadState] = useState<
    'idle' | 'loading' | 'complete'
  >('idle');

  const [livepeerAsset, setLivepeerAsset] = useState<any>();

  const activeAccount = useActiveAccount();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    onFileSelect(file);
    console.log('Selected file:', file?.name);
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file to upload.');
      return;
    }

    setError(null);
    setUploadState('loading');
    setProgress(0);

    try {
      console.log('Start upload #1');

      const uploadRequestResult = await getLivepeerUploadUrl(
        newAssetTitle || selectedFile.name || 'new file name',
        activeAccount?.address || 'anonymous',
      );

      setLivepeerAsset(uploadRequestResult?.asset);

      const tusUpload = new tus.Upload(selectedFile, {
        endpoint: uploadRequestResult?.tusEndpoint,
        metadata: {
          filename: selectedFile.name,
          filetype: 'video/mp4',
        },
        uploadSize: selectedFile.size,
        onError(err: any) {
          console.error('Error uploading file:', err);
          setError('Failed to upload file. Please try again.');
          setUploadState('idle');
        },
        onProgress(bytesUploaded, bytesTotal) {
          const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
          console.log('Uploaded ' + percentage + '%');
          setProgress(percentage);
        },
        onSuccess() {
          console.log('Upload finished:', tusUpload.url);
          setUploadState('complete');
          setError(null); // Clear any previous errors
          onFileUploaded(tusUpload?.url || '');
        },
      });

      const previousUploads = await tusUpload.findPreviousUploads();

      if (previousUploads.length > 0) {
        tusUpload.resumeFromPreviousUpload(previousUploads[0]);
      }

      tusUpload.start();

      const formData = new FormData();

      formData.append('audio', selectedFile);

      const audioToTextResponse = await getLivepeerAudioToText({
        formData,
        modelId: 'openai/whisper-large-v3',
        returnTimestamps: 'true',
      });

      console.log({ audioToTextResponse });

      const subtitles = await translateSubtitles({
        chunks: audioToTextResponse?.chunks,
      });

      const ipfsUri = await upload({
        client,
        files: [subtitles],
      });

      onSubtitlesUploaded(ipfsUri);
    } catch (error: any) {
      console.error('Error processing file:', error);
      if (uploadState !== 'complete') {
        setError('Failed to process file. Please try again.');
        setUploadState('idle');
      }
    }
  };

  return (
    <div>
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full rounded-lg p-8 shadow-lg">
          <h1 className="mb-4 text-2xl font-semibold">Upload A File</h1>

          {/* File Input */}
          <div className="mb-6">
            <label
              htmlFor="file-upload"
              className="mb-2 block text-sm font-medium"
            >
              Choose A File To Upload:
            </label>
            <input
              type="file"
              id="file-upload"
              accept="video/*"
              className="file:border-1 block w-full text-sm text-[#EC407A] file:mr-4 file:cursor-pointer file:rounded-full file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#EC407A] hover:file:bg-gray-200"
              data-testid="file-upload-input"
              onChange={handleFileChange}
            />
            {/* Display selected file name */}
            {selectedFile && (
              <div>
                <p className="mt-2 overflow-hidden text-ellipsis whitespace-nowrap text-lg text-gray-400">
                  Selected File: {selectedFile.name}
                </p>
                <PreviewVideo video={selectedFile} />
              </div>
            )}
          </div>

          {/* Upload Button and Progress Bar */}
          <div className="flex w-full flex-col items-start space-y-4">
            {uploadState === 'idle' ? (
              <button
                onClick={handleFileUpload}
                disabled={!selectedFile}
                className={`${
                  !selectedFile
                    ? 'cursor-not-allowed bg-[#D63A6A]'
                    : 'bg-[#EC407A] hover:bg-[#D63A6A]'
                } cursor-pointer rounded-lg px-4 py-2 font-semibold text-white`}
                data-testid="file-input-upload-button"
              >
                Upload File
              </button>
            ) : (
              <div className="w-full">
                <Progress
                  value={progress}
                  max={100}
                  className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
                >
                  <div
                    className="h-full bg-[#EC407A] transition-all duration-500 ease-in-out"
                    style={{ width: `${progress}%` }}
                  />
                </Progress>
                <p className="mt-2 text-sm text-gray-400">
                  {uploadState === 'complete'
                    ? 'Upload Complete!'
                    : `${progress}% uploaded`}
                </p>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && <p className="mt-4 text-red-500">{error}</p>}

          {/* Success Message */}
          {uploadedUri && (
            <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-green-700">
                File uploaded successfully! IPFS URI:{' '}
                <Link
                  href={uploadedUri}
                  target="_blank"
                  className="overflow-hidden text-ellipsis whitespace-nowrap text-green-500 underline"
                >
                  {truncateUri(uploadedUri)}
                </Link>
                <button
                  onClick={() => copyToClipboard(uploadedUri)}
                  className="ml-2 text-sm text-green-600 hover:text-green-800"
                >
                  <CopyIcon className="h-5 w-5" />
                  <span>Copy</span>
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-center gap-3">
        {onPressBack && (
          <Button disabled={uploadState === 'loading'} onClick={onPressBack}>
            Back
          </Button>
        )}
        {onPressNext && (
          <Button
            disabled={uploadState !== 'complete'}
            onClick={() => {
              if (livepeerAsset) {
                onPressNext(livepeerAsset);
              } else {
                alert('Missing livepeer asset');
              }
            }}
            data-testid="file-input-next"
          >
            Next
          </Button>
        )}
      </div>
    </div>
  );
};

export default FileUpload;
