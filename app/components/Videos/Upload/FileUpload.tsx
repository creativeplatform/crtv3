'use client';
import React, { useState } from 'react';
import { upload } from 'thirdweb/storage'; // Ensure correct import
import { client } from '@app/lib/sdk/thirdweb/client';
import { toast } from 'sonner';
import { CopyIcon } from 'lucide-react';

// Add these functions to your component

const truncateUri = (uri: string): string => {
  if (uri.length <= 30) return uri;
  return uri.slice(0, 15) + '...' + uri.slice(-15);
};

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text).then(() => {
    // Optionally, you can show a temporary "Copied!" message here
    toast('IPFS URI Copied!');
  });
};

interface FileUploadProps {
  onFileSelect: (file: File | null) => void;
  onFileUploaded: (fileUrl: string) => void; // Callback to send the uploaded file URL back
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  onFileUploaded,
}) => {
  // Destructure onFileUploaded
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadedUri, setUploadedUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    onFileSelect(file); // Notify parent component of the selected file
    console.log('Selected file:', file?.name);
  };

  const handleFileUpload = async () => {
    console.log('Start upload #1');
    if (!selectedFile) {
      setError('Please select a file to upload.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      console.log('Start upload #2');

      // Upload to IPFS using thirdweb/storage
      const uploadedFiles = await upload({
        client,
        files: [
          new File(
            [new Blob([selectedFile])], // Create a Blob instead of using File directly
            selectedFile?.name, // Provide a valid filename
          ),
        ],
      });

      if (uploadedFiles.length === 0) {
        throw new Error('No files were uploaded.');
      }

      //const ipfsUrl = uploadedFiles[0]; // Get the IPFS URI
      console.log('IPFS URI:', uploadedFiles);
      setUploadedUri(uploadedFiles);

      // Call the onFileUploaded callback with the uploaded file URL
      onFileUploaded(uploadedFiles);
    } catch (error: any) {
      console.error('Error uploading file:', error);
      setError('Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center justify-center bg-[#1a1c1f] px-4 py-10">
      <div className="w-full rounded-lg p-8 shadow-lg">
        <h1 className="mb-4 text-2xl font-semibold text-gray-200">
          Upload A File
        </h1>

        {/* File Input */}
        <div className="mb-6">
          <label
            htmlFor="file-upload"
            className="mb-2 block text-sm font-medium text-gray-400"
          >
            Choose A File To Upload:
          </label>
          <input
            type="file"
            id="file-upload"
            accept="video/*"
            className="block w-full text-sm text-[#EC407A] file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#EC407A] hover:file:bg-gray-200"
            onChange={handleFileChange}
          />
          {/* Display selected file name */}
          {selectedFile && (
            <div>
              <p className="mt-2 overflow-hidden text-ellipsis whitespace-nowrap text-gray-300">
                Selected file: {selectedFile.name}
              </p>
            </div>
          )}
        </div>

        {/* Upload Button */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleFileUpload}
            disabled={!selectedFile || uploading}
            className={`${
              uploading
                ? 'cursor-not-allowed bg-[#D63A6A]'
                : 'bg-[#EC407A] hover:bg-[#D63A6A]'
            } cursor-pointer rounded-lg px-4 py-2 font-semibold text-white`}
          >
            {uploading ? 'Uploading...' : 'Upload File'}
          </button>
        </div>

        {/* Error Message */}
        {error && <p className="mt-4 text-red-500">{error}</p>}

        {/* Success Message */}
        {uploadedUri && (
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-green-700">
              File uploaded successfully! IPFS URI:{' '}
              <a
                href={uploadedUri}
                target="_blank"
                rel="noopener noreferrer"
                className="overflow-hidden text-ellipsis whitespace-nowrap text-green-500 underline"
              >
                {truncateUri(uploadedUri)}
              </a>
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
  );
};

export default FileUpload;
