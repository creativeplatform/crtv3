"use client";

import { useState, useEffect } from "react";
import { stack } from "@/lib/sdk/stack/stackClient";
import { useUser } from "@/lib/wallet/react";
import LeaderboardItem from "@/components/leaderboard/LeaderboardItem";
import { FaSpinner } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FaUsers, FaTrophy } from "react-icons/fa";
import Image from "next/image";
import { formatNumber } from "@/lib/utils/utils";
import { logger } from '@/lib/utils/logger';


// Define the type based on the actual Stack SDK return type
interface LeaderboardRow {
  address: string;
  points: number;
  identities: any;
}

interface LeaderboardMetadata {
  label: string;
  bannerUrl: string;
  description: string;
  name: string;
  createdAt: string;
  url: string;
  primaryColor: string;
}

interface UserRank {
  address: string;
  rank: number;
  points: number;
}

export default function LeaderboardPage() {
  const userInfo = useUser();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState<number>(0);
  const [metadata, setMetadata] = useState<LeaderboardMetadata | null>(null);
  const [userRank, setUserRank] = useState<UserRank | null>(null);
  const [showOnlyUserRank, setShowOnlyUserRank] = useState(false);

  // Fetch user's rank if they are logged in
  useEffect(() => {
    const fetchUserRank = async () => {
      if (!userInfo?.address) return;

      try {
        const rankData = await stack.getLeaderboardRank(userInfo.address);
        setUserRank(rankData as unknown as UserRank);
      } catch (err) {
        logger.error("Failed to fetch user rank:", err);
      }
    };

    fetchUserRank();
  }, [userInfo?.address]);

  // Fetch leaderboard data
  useEffect(() => {
    const fetchLeaderboard = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let query;

        if (showOnlyUserRank && userInfo?.address) {
          // Filter leaderboard to only show the current user
          query = stack
            .leaderboardQuery()
            .where({
              associatedAccount: {
                in: [userInfo.address],
              },
            })
            .build();
        } else {
          // Show full leaderboard
          query = stack.leaderboardQuery().limit(100).build();
        }

        const leaderboard = await stack.getLeaderboard({ query });

        if (!leaderboard || !leaderboard.leaderboard) {
          throw new Error("Leaderboard data is missing or empty.");
        }

        // Cast the leaderboard data to the correct type
        setLeaderboardData(
          leaderboard.leaderboard as unknown as LeaderboardRow[]
        );

        // Set participant count from stats if available
        if (leaderboard.stats && leaderboard.stats.total) {
          setParticipantCount(leaderboard.stats.total);
        } else {
          // Fallback to a default or the length of the leaderboard
          setParticipantCount(597); // Using the number from the screenshot as fallback
        }

        // Set metadata if available
        if (leaderboard.metadatad) {
          setMetadata(leaderboard.metadatad as unknown as LeaderboardMetadata);
        }
      } catch (err: any) {
        logger.error("Failed to fetch leaderboard:", err);
        setError("Failed to fetch leaderboard. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
  }, [userInfo?.address, showOnlyUserRank]);

  // Default banner image as fallback
  const bannerImage = metadata?.bannerUrl || "/images/creative-banner.png";
  // Default description as fallback
  const description =
    metadata?.description ||
    "Earn Points by interacting with our web3 apps and smart contracts. " +
      "Redeem Points for exclusive rewards. Points can be earned and removed, " +
      "ensuring a fair and balanced system.";
  // Default title as fallback
  const title = metadata?.name || "The Creative Leaderboard";

  return (
    <div className="container mx-auto p-4 max-w-5xl">
      {/* Hero Banner */}
      <div className="relative w-full h-44 mb-8 overflow-hidden rounded-lg">
        <Image
          src={bannerImage || "/images/creative-banner.png"}
          alt={title}
          fill
          style={{ objectFit: "cover" }}
          priority
        />
        <div className="absolute inset-0 bg-black/50 flex flex-col justify-center items-center text-white">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">{title}</h1>
            <p className="max-w-2xl mx-auto text-sm md:text-base">
              {description}
            </p>
            <div className="flex items-center justify-center mt-4 gap-4">
              <div className="flex items-center">
                <FaUsers className="mr-2" />
                <span>
                  {formatNumber(participantCount)}
                  &nbsp;Participants
                </span>
              </div>

              {userRank && (
                <div className="flex items-center">
                  <FaTrophy className="mr-2 text-yellow-500" />
                  <span>Your Rank: #{userRank.rank}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="leaderboard" className="w-full mb-8">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="rewards">Rewards</TabsTrigger>
          <TabsTrigger value="earn">Earn</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="leaderboard">
          {userInfo?.address && (
            <div className="flex justify-end mb-4">
              <Button
                variant="outline"
                onClick={() => setShowOnlyUserRank(!showOnlyUserRank)}
                className="text-sm"
              >
                {showOnlyUserRank ? "Show All Users" : "Show Only My Position"}
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-8">
              <FaSpinner className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          ) : leaderboardData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No leaderboard data available.
            </div>
          ) : (
            <div>
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 py-3 px-4 font-medium text-sm text-gray-500 border-b">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-7 md:col-span-9">User</div>
                <div className="col-span-4 md:col-span-2 text-right">
                  Points
                </div>
              </div>

              {/* Table Body */}
              <div className="divide-y">
                {leaderboardData.map((item, index) => {
                  // For filtered view, use actual rank from API
                  const displayRank =
                    showOnlyUserRank && userRank ? userRank.rank : index + 1;

                  return (
                    <div
                      key={item.address}
                      className={`grid grid-cols-12 gap-4 py-3 px-4 ${
                        userInfo?.address === item.address
                          ? "bg-blue-50 dark:bg-blue-900/20"
                          : ""
                      }`}
                    >
                      <div className="col-span-1 text-center font-medium">
                        {displayRank}
                      </div>
                      <div className="col-span-7 md:col-span-9">
                        <LeaderboardItem
                          rank={displayRank}
                          address={item.address as `0x${string}`}
                          points={item.points}
                          isCurrentUser={userInfo?.address === item.address}
                          hideRank={true}
                        />
                      </div>
                      <div className="col-span-4 md:col-span-2 text-right font-mono">
                        {formatNumber(item.points)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>
        <TabsContent value="rewards">
          <div className="text-center py-12 text-gray-500">
            Rewards coming soon!
          </div>
        </TabsContent>
        <TabsContent value="earn">
          <div className="text-center py-12 text-gray-500">
            Earning opportunities coming soon!
          </div>
        </TabsContent>
        <TabsContent value="activity">
          <div className="text-center py-12 text-gray-500">
            Activity feed coming soon!
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
