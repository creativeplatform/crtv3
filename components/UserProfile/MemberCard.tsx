"use client";
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";
import { convertFailingGateway, isIpfsUrl } from '@/lib/utils/image-gateway';
import { getPassDisplayName } from "@/lib/access/membership-labels";

export type MemberCardProps = {
  member: any;
  nft: any;
  balance: string;
  points: number;
};

function fromTimestampToDate(timestamp: number): string {
  if (!timestamp) return "";
  // Check for unreasonably large expiration dates (likely MAX_UINT or similar "lifetime" markers)
  // 32503680000 is roughly year 3000
  if (timestamp > 32503680000) return "Never";
  const date = new Date(timestamp * 1000);
  if (date.toString() === "Invalid Date") return "Never";
  return date.toLocaleDateString();
}

const MemberCard = ({ member, nft, points }: MemberCardProps) => {
  if (!nft) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-lg bg-muted/50 p-6 text-center">
        <p className="text-muted-foreground">No membership NFT found</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-card">
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* NFT Image Section */}
        {nft.metadata?.image && (
          <div className="relative w-full md:w-auto">
            <Image
              priority
              src={convertFailingGateway(nft.metadata.image)}
              alt={nft.metadata.name || "NFT Image"}
              height={250}
              width={200}
              className="mx-auto rounded-lg object-cover md:mx-0"
              unoptimized={isIpfsUrl(nft.metadata.image)}
            />
          </div>
        )}

        {/* Content Section */}
        <div className="flex flex-1 flex-col justify-between space-y-6 p-4 lg:p-6">
          <div className="space-y-4">
            <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
              {getPassDisplayName(nft?.lockAddress ?? nft?.metadata?.contract)}
            </h1>
            <div className="flex flex-col space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Points Balance
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-primary">{points}</p>
                <p className="text-sm text-muted-foreground">points</p>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="space-y-2 rounded-lg bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Member Address
              </span>
              <span className="font-mono text-sm">
                {member?.address?.slice(0, 6)}...{member?.address?.slice(-4)}
              </span>
            </div>
            {/* Uncomment when ready to use */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Member ID</span>
              <span className="font-mono text-sm">{nft.metadata?.id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Expires</span>
              <span className="font-mono text-sm">
                {nft.expirationDuration ? (
                  fromTimestampToDate(nft.expirationDuration)
                ) : (
                  <Skeleton className="h-4 w-[100px]" />
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberCard;
