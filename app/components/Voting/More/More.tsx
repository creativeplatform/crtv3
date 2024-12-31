'use client';
import { Suspense } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { shortenAddress } from 'thirdweb/utils';
import { useRouter, useSearchParams } from 'next/navigation';
import { Voting } from '@app/components/Voting/Voting';
import ClaimPoap from '@app/components/Voting/ClaimPoap';

/**
 * Renders the "More" component.
 *
 * @returns JSX.Element
 */
export default function MoreOptions() {
  const router = useRouter();
  const activeAccount = useActiveAccount();
  const searchParams = useSearchParams();

  // Correct use of searchParams
  const end = searchParams.get('end');
  const start = searchParams.get('start');
  const title = searchParams.get('title');
  const body = searchParams.get('body');
  const choices = JSON.parse(searchParams.get('choices') || '[]');
  const snapshot = searchParams.get('snapshot');
  const creator = searchParams.get('creator');
  const score = searchParams.get('score');
  const scores = JSON.parse(searchParams.get('scores') || '{}');
  const identifier = searchParams.get('identifier');

  /**
   * Opens a new browser window to display the details of a specific block on PolygonScan.
   * @param id - The ID of the block to navigate to.
   */
  const goTo = (id: any) => {
    let url = `https://polygonscan.com/block/${id}`;
    window.open(url, '_blank');
  };

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className="flex flex-col items-center justify-center p-4">
        <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
          <div className="col-span-1">
            <div className="p-4">
              <div>
                <h1 className="text-2xl font-bold">{title}</h1>
              </div>
              <div className="break-words">
                <p>{body}</p>
              </div>
            </div>
          </div>
          <div className="col-span-1">
            <div className="mb-5 cursor-pointer">
              <div className="flex rounded-t-lg bg-gradient-to-l from-yellow-300 via-red-600 to-pink-400 p-2">
                <h2 className="text-md font-bold text-white">Details</h2>
              </div>
              <div className="rounded-b-lg border-2 border-pink-500 p-10">
                <div className="p-2">
                  <p>{`Creator: ${creator ? shortenAddress(creator) : 'Unknown'}`}</p>
                  <p
                    className="cursor-pointer"
                    onClick={() => goTo(snapshot)}
                  >{`Snapshot: ${snapshot}`}</p>
                </div>
                <div className="rounded-lg bg-black p-2">
                  <div className="flex">
                    <p className="text-white">{`Start Date: ${start}`}</p>
                  </div>
                  <div className="flex">
                    <p className="text-white">{`End Date: ${end}`}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mb-5 cursor-pointer">
              <div className="flex rounded-t-lg bg-gradient-to-l from-yellow-300 via-red-600 to-pink-400 p-2">
                <h2 className="text-md font-bold text-white">
                  Current Results
                </h2>
              </div>
              <div className="break-words rounded-b-lg border-2 border-pink-500 p-10">
                <Voting choices={choices} score={score} scores={scores} />
              </div>
            </div>
            {activeAccount && (
              <div className="mb-5 cursor-pointer">
                <div className="bg-brand-400 flex rounded-t-lg p-2">
                  <h2 className="text-md font-bold text-white">I Voted POAP</h2>
                </div>
                <div className="rounded-b-lg border-2 border-pink-500 p-10">
                  <ClaimPoap
                    address={activeAccount?.address as string}
                    proposalId={identifier as string}
                    snapshot={snapshot as string}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Suspense>
  );
}
