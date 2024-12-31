'use client';
import Image from 'next/image';
import { Ban, Repeat2 } from 'lucide-react';

export type MemberCardProps = {
  member: any;
  nft: any;
  balance: string;
  points: number;
};

const MemberCard = ({ member, nft, balance, points }: MemberCardProps) => {
  if (!nft) {
    return <div className="p-4 text-center">No membership NFT found</div>;
  }

  return (
    <div className="flex flex-col items-center gap-6 p-4 md:flex-row">
      {nft.metadata?.image && (
        <div className="relative w-full md:w-auto">
          <Image
            priority
            src={nft.metadata.image}
            alt={nft.metadata.name || 'NFT Image'}
            height={250}
            width={200}
            className="mx-auto rounded-lg object-cover md:mx-0"
            unoptimized
          />
        </div>
      )}
      <div className="flex w-full flex-col space-y-4 text-center md:text-left">
        <h1 className="text-xl font-bold md:text-2xl">{nft.metadata?.name}</h1>
        <div className="flex flex-col space-y-2">
          <p className="text-md font-semibold">Points Balance</p>
          <p className="text-2xl font-bold text-primary">{points} points</p>
        </div>
        {/* Uncomment when ready to use
        <p className="text-md">Member Id: {nft.metadata?.id}</p>
        <p>
          Expires in{' '}
          {nft.expirationDuration ? (
            fromTimestampToDate(nft.expirationDuration)
          ) : (
            <Skeleton className="h-4 w-[250px]" />
          )}
        </p>
        */}
      </div>
    </div>
  );
};

export default MemberCard;
