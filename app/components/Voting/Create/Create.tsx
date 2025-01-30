'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@app/components/ui/input';
import { Textarea } from '@app/components/ui/textarea';
import { Button } from '@app/components/ui/button';
import { Loader2 } from 'lucide-react';
import { FaWindowClose } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import { base } from 'thirdweb/chains';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@app/components/ui/select';
import { toast } from 'sonner';
import { useSnapshot } from '@app/hooks/useSnapshot';
import { useActiveAccount } from 'thirdweb/react';
import { useCurrentBlockNumber } from '@app/hooks/useCurrentBlockNumber';

const VOTING_TYPES = {
  'single-choice': 'Single Choice',
  weighted: 'Weighted',
} as const;

const VOTING_STRATEGIES = [
  {
    name: 'erc20-balance-of',
    params: {
      address: process.env.NEXT_PUBLIC_TOKEN_ADDRESS,
      symbol: 'CRTV',
      decimals: 18,
    },
  },
  {
    name: 'erc20-balance-of',
    params: {
      address: process.env.NEXT_PUBLIC_TOKEN_ADDRESS,
      symbol: 'CRTV',
      decimals: 18,
    },
  },
];

type VotingType = keyof typeof VOTING_TYPES;

export default function Create() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [startDate, setStartDate] = useState(0);
  const [endDate, setEndDate] = useState(0);
  const [choices, setChoices] = useState(['yes', 'no']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [votingType, setVotingType] = useState<VotingType>('single-choice');
  const [votingPower, setVotingPower] = useState<bigint>(0n);
  const [minScore, setMinScore] = useState<number>(100); // Minimum score required to create proposal
  const router = useRouter();
  const { createProposal, getVotingPower, isConnected } = useSnapshot();
  const activeAccount = useActiveAccount();
  const blockNumber = useCurrentBlockNumber();

  useEffect(() => {
    const checkVotingPower = async () => {
      if (!isConnected || !activeAccount?.address || !blockNumber) return; // Exit if no block number

      try {
        const vp = await getVotingPower({
          address: activeAccount.address,
          strategies: VOTING_STRATEGIES,
          space: 'thecreative.eth',
          snapshot: Number(blockNumber), // Use available block number
          network: base.id.toString(),
        });

        setVotingPower(vp.vp ? BigInt(vp.vp) : 0n);
      } catch (error) {
        console.error('Error checking voting power:', error);
        toast.error('Failed to check voting power');
      }
    };

    checkVotingPower();
  }, [isConnected, getVotingPower, activeAccount, blockNumber]);

  function handleChange(i: number, event: React.ChangeEvent<HTMLInputElement>) {
    const values = [...choices];
    values[i] = event.target.value;
    setChoices(values);
  }

  function handleAdd() {
    const values = [...choices];
    values.push('');
    setChoices(values);
  }

  function handleRemove(i: number) {
    const values = [...choices];
    values.splice(i, 1);
    setChoices(values);
  }

  const validateProposal = () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return false;
    }
    if (!content.trim()) {
      toast.error('Content is required');
      return false;
    }
    if (choices.some((choice) => !choice.trim())) {
      toast.error('All choices must have content');
      return false;
    }
    if (startDate >= endDate) {
      toast.error('End date must be after start date');
      return false;
    }
    if (votingPower < BigInt(minScore)) {
      toast.error(
        `You need at least ${minScore} voting power to create a proposal`,
      );
      return false;
    }
    return true;
  };

  const submit = async () => {
    if (!blockNumber) {
      toast.error('Waiting for block number...');
      return;
    }

    if (!validateProposal()) {
      return;
    }

    await createProposal({
      space: 'thecreative.eth',
      type: votingType,
      title: title,
      body: content,
      choices: choices,
      start: Math.floor(startDate / 1000), // Convert to UNIX timestamp
      end: Math.floor(endDate / 1000), // Convert to UNIX timestamp
      snapshot: Number(blockNumber),
    });
    toast.success('Proposal created successfully!');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-4">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Create Proposal</h1>

        <div className="rounded-lg bg-blue-50 p-4 text-blue-700">
          You need at least 100 CRTV tokens to create a proposal
        </div>

        {votingPower > 0n && (
          <div className="rounded-lg bg-green-50 p-4 text-green-700">
            Your voting power: {votingPower.toString()}
            {votingPower < BigInt(minScore) && (
              <div className="mt-2 text-red-600">
                You need {(BigInt(minScore) - votingPower).toString()} more CRTV
                tokens to create proposals
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Voting Type</label>
          <Select
            value={votingType}
            onValueChange={(value: VotingType) => setVotingType(value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select voting type" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(VOTING_TYPES).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Title</label>
          <Input
            type="text"
            placeholder="Enter proposal title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Content</label>
          <Textarea
            placeholder="Enter proposal content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
          />
        </div>

        <div className="space-y-4">
          <label className="text-sm font-medium">Choices</label>
          {choices.map((choice, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                type="text"
                placeholder={`Choice ${index + 1}`}
                value={choice}
                onChange={(e) => handleChange(index, e)}
              />
              {choices.length > 2 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(index)}
                >
                  <FaWindowClose className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="outline" onClick={handleAdd}>
            Add Choice
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Start Date</label>
            <Input
              type="datetime-local"
              onChange={(e) =>
                setStartDate(
                  Math.floor(new Date(e.target.value).getTime() / 1000),
                )
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">End Date</label>
            <Input
              type="datetime-local"
              onChange={(e) =>
                setEndDate(
                  Math.floor(new Date(e.target.value).getTime() / 1000),
                )
              }
            />
          </div>
        </div>

        <Button
          className="w-full"
          onClick={submit}
          disabled={isSubmitting || votingPower < BigInt(minScore)}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Proposal...
            </>
          ) : (
            'Create Proposal'
          )}
        </Button>
      </div>
    </div>
  );
}
