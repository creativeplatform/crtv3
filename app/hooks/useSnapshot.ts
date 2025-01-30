'use client';

import snapshot from '@snapshot-labs/snapshot.js';
import { useCallback } from 'react';
import { useViemAdapter } from './useViemAdapter';
import { viemAdapter } from 'thirdweb/adapters/viem';
import { base } from 'thirdweb/chains';

const API_KEY = process.env.NEXT_PUBLIC_SNAPSHOT_API_KEY;

// Initialize Snapshot client
const hub = `https://hub.snapshot.org`;
const client = new snapshot.Client712(hub);

// Helper function to add API key to URL
const addApiKey = (url: string) => {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}apiKey=${API_KEY}`;
};

export function useSnapshot() {
  const { getViemWallet, activeAccount } = useViemAdapter();

  const getProvider = useCallback(() => {
    return viemAdapter.publicClient.toViem({
      client,
      chain: base,
    });
  }, []);

  const vote = useCallback(
    async ({
      space,
      proposal,
      choice,
      reason,
      type = 'single-choice',
    }: {
      space: string;
      proposal: string;
      choice: number;
      reason?: string;
      type?: string;
    }) => {
      if (!activeAccount) throw new Error('No active account');

      const wallet = getViemWallet();
      const provider = getProvider();

      return await client.vote(wallet, activeAccount.address, {
        space,
        proposal,
        type,
        choice,
        reason,
        app: 'creative-platform',
      });
    },
    [activeAccount, getViemWallet, getProvider],
  );

  const createProposal = useCallback(
    async ({
      space,
      title,
      body,
      choices,
      start,
      end,
      snapshot,
      type = 'single-choice',
    }: {
      space: string;
      title: string;
      body: string;
      choices: string[];
      start: number;
      end: number;
      snapshot: number;
      type?: string;
    }) => {
      if (!activeAccount) throw new Error('No active account');

      const wallet = getViemWallet();

      return await client.proposal(wallet, activeAccount.address, {
        space,
        type,
        title,
        body,
        choices,
        start,
        end,
        snapshot,
        plugins: JSON.stringify({}),
        app: 'creative-platform',
      });
    },
    [activeAccount, getViemWallet],
  );

  const joinSpace = useCallback(
    async (space: string) => {
      if (!activeAccount) throw new Error('No active account');

      const wallet = getViemWallet();

      return await client.follow(wallet, activeAccount.address, {
        space,
      });
    },
    [activeAccount, getViemWallet],
  );

  const getVotingPower = useCallback(
    async ({
      address,
      strategies,
      space,
      snapshot: blockNumber,
      network = '1',
    }: {
      address: string;
      strategies: any[];
      space: string;
      snapshot: number;
      network?: string;
    }) => {
      const scores = await snapshot.utils.getScores(
        space,
        strategies,
        network,
        [address], // Voters array
        blockNumber, // Snapshot block number
        addApiKey('https://score.snapshot.org'), // URL with API key
      );

      // Sum scores across all strategies
      const totalScore = scores.reduce(
        (sum: number, strategyScores: Record<string, number>) => {
          return sum + (strategyScores[address.toLowerCase()] || 0);
        },
        0,
      );

      return { vp: totalScore };
    },
    [],
  );

  return {
    vote,
    createProposal,
    joinSpace,
    getVotingPower,
    isConnected: !!activeAccount,
  };
}
