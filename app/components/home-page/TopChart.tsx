'use client';
import { useState, useEffect } from 'react';
import { Avatar, AvatarImage } from '../ui/avatar';
import makeBlockie from 'ethereum-blockies-base64';
import {
  AccountProvider,
  AccountAvatar,
  AccountName,
  AccountBalance,
  AccountAddress,
  AccountBlobbie,
} from 'thirdweb/react';
import { shortenAddress } from 'thirdweb/utils';
import { stack } from '@app/lib/sdk/stack/client';
import { client } from '@app/lib/sdk/thirdweb/client';
import { resolveName } from 'thirdweb/extensions/ens';
import { Button } from '../ui/button'; // Assuming you have a Button component
import { FaSpinner } from 'react-icons/fa';
import Link from 'next/link';

interface LeaderboardItem {
  uniqueId: number;
  address: string;
  points: number;
  identities: any;
  bannerUrl?: string;
  name?: string;
  description?: string;
}

export function TopChart() {
  const [data, setData] = useState<LeaderboardItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        // Construct the leaderboard query with a limit of 20
        const query = stack.leaderboardQuery().limit(20).build();

        // Fetch the leaderboard with the constructed query
        const leaderboard = await stack.getLeaderboard({ query });

        if (!leaderboard || !leaderboard.leaderboard) {
          console.warn('Leaderboard data is missing or empty.');
          setErrorMessage('Leaderboard data is missing or empty.');
          setData([]);
          return;
        }

        // Set leaderboard data directly without mapping
        setData(
          Array.isArray(leaderboard.leaderboard) ? leaderboard.leaderboard : [],
        );
      } catch (error: any) {
        console.error('Error fetching leaderboard data:', error);
        setErrorMessage('Failed to load leaderboard. Please try again later.');
        setData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Split data into columns
  const columns: LeaderboardItem[][] = [[], [], [], []]; // Adjust this if you want more or fewer columns
  data.forEach((item, index) => {
    const columnIndex = Math.floor(index / 5); // Divide items into groups of 5
    if (columns[columnIndex]) {
      columns[columnIndex].push(item);
    }
  });

  return (
    <div className="mx-auto w-full max-w-6xl py-8">
      <div className="mb-8 text-center">
        <h2 className="flex items-center justify-center gap-2 text-3xl font-bold">
          <TrophyIcon className="h-6 w-6 text-yellow-500" />
          TOP CREATIVES
        </h2>
      </div>

      {isLoading ? (
        <div className="flex justify-center">
          <FaSpinner className="mr-3 h-5 w-5 animate-spin" />{' '}
          {/* Replace with your actual Spinner component */}
        </div>
      ) : errorMessage ? (
        <div className="text-center">
          <p className="text-red-500">{errorMessage}</p>
          <Button onClick={() => window.location.reload()} className="mt-2">
            Retry
          </Button>
        </div>
      ) : data.length === 0 ? (
        <p className="text-center text-gray-500">
          No leaderboard data available.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {columns.map((column, colIndex) => (
            <div
              key={colIndex}
              className={`mx-auto space-y-4 ${
                colIndex === 3 ? 'hidden lg:block' : ''
              } ${colIndex === 2 ? 'hidden md:block' : ''} `}
            >
              {column.map(({ uniqueId, address, points }, index) => (
                <AccountProvider
                  key={uniqueId}
                  address={address}
                  client={client}
                >
                  <div className="flex items-center space-x-2">
                    <span className="min-w-[24px] text-right font-medium">
                      {colIndex * Math.ceil(data.length / 4) + index + 1}.
                    </span>
                    <AccountAvatar
                      className="h-10 w-10 rounded-full"
                      loadingComponent={
                        <Avatar>
                          <AvatarImage
                            src={makeBlockie(address)}
                            className="h-10 w-10 rounded-full"
                          />
                        </Avatar>
                      }
                      fallbackComponent={
                        <Avatar>
                          <AvatarImage
                            src={makeBlockie(address)}
                            className="h-10 w-10 rounded-full"
                          />
                        </Avatar>
                      }
                    />
                    <div className="flex flex-col">
                      <AccountName
                        className="text-left"
                        loadingComponent={
                          <AccountAddress
                            formatFn={shortenAddress}
                            className="text-left"
                          />
                        }
                        fallbackComponent={
                          <AccountAddress
                            formatFn={shortenAddress}
                            className="text-left"
                          />
                        }
                      />
                      <span className="text-gray-500">{points} points</span>
                    </div>
                  </div>
                </AccountProvider>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="mt-8 flex justify-center">
        <Link
          href="https://points.creativeplatform.xyz"
          target="_blank"
          className="w-full max-w-md"
        >
          <Button
            variant="outline"
            className="w-full py-6 text-lg font-semibold hover:bg-muted"
          >
            View Leaderboard
          </Button>
        </Link>
      </div>
    </div>
  );
}

function TrophyIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}
