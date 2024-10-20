import React, { FC, useEffect, useState } from 'react';

interface PreviewVideoProps {
  video: File | null;
}

const PreviewVideo: FC<PreviewVideoProps> = ({ video }) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (video) {
      const objectUrl = URL.createObjectURL(video);
      setVideoUrl(objectUrl);

      // Clean up the object URL when the component unmounts or video changes
      return () => {
        URL.revokeObjectURL(objectUrl);
      };
    } else {
      setVideoUrl(null); // Reset the video URL if no video is provided
    }
  }, [video]); // Dependency on video prop

  return (
    <div className="flex w-full justify-center">
      {videoUrl && (
        <video
          controls
          src={videoUrl} // Directly set src attribute
          className="mt-2 max-h-96 max-w-full"
        >
          Your browser does not support the video tag.
        </video>
      )}
    </div>
  );
};

export default PreviewVideo;
