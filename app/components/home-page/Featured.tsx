'use client';
import { useEffect, useState } from 'react';
import { Src } from '@livepeer/react';
import { FEATURED_VIDEO_TITLE } from '@app/lib/utils/context';
import { getFeaturedPlaybackSource } from '@app/lib/utils/hooks/useFeaturePlaybackSource';
import { DemoPlayer } from '../Player/DemoPlayer';
import { Skeleton } from '@app/components/ui/skeleton';

const FeaturedVideo: React.FC = () => {
  const [src, setSrc] = useState<Src[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSource = async () => {
      try {
        const playbackSource = await getFeaturedPlaybackSource();
        setSrc(playbackSource);
      } catch (err) {
        console.error('Error fetching playback source:', err);
        setError('Failed to load video.');
      } finally {
        setLoading(false);
      }
    };

    fetchSource();
  }, []);
  if (loading) {
    return (
      <div className="relative aspect-video w-full max-w-2xl overflow-hidden rounded-lg">
        {/* Skeleton displayed while loading */}
        <Skeleton className="h-[340px] w-full" />
      </div>
    );
  }

  if (error) {
    return <div>{error}</div>;
  }
  return (
    <section className="w-full py-12 md:py-24 lg:py-32">
      <div className="container grid items-center gap-6 px-4 md:px-6 lg:grid-cols-2 lg:gap-10">
        <div className="relative aspect-video w-full max-w-2xl overflow-hidden rounded-lg">
          <DemoPlayer src={src} title={FEATURED_VIDEO_TITLE} />
          <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/50 to-transparent p-4 text-lg text-white">
            <div className="line-clamp-1">{FEATURED_VIDEO_TITLE}</div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="inline-block rounded-lg bg-muted px-3 py-1 text-sm">
              Featured Video
            </div>
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
              {FEATURED_VIDEO_TITLE}
            </h2>
            <p className="max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Explore the intersection of technology, innovation, and the
              creative economy. Hosted by industry leaders, each episode
              features in-depth conversations with artists, entrepreneurs, and
              tech pioneers who are shaping the future of creative industries
              through blockchain, AI, and digital media.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
export default FeaturedVideo;
