'use client';
import React, { useState, useRef } from 'react';
import { Input } from '@app/components/ui/input';
import { Textarea } from '@app/components/ui/textarea';
import { Button } from '@app/components/ui/button';
import { Loader2 } from 'lucide-react';
import snapshot from '@snapshot-labs/snapshot.js';
import { useActiveAccount, useBlockNumber } from 'thirdweb/react';
import { FaWindowClose } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import { Web3Provider } from '@ethersproject/providers';
import { client } from '@app/lib/sdk/thirdweb/client';
import { base } from 'thirdweb/chains';

const hub = 'https://hub.snapshot.org';
const hub_client = new snapshot.Client712(hub);

/**
 * Renders the Create component.
 *
 * @returns The JSX element representing the Create component.
 */
export default function Create() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [startDate, setStartDate] = useState(0);
  const [startTime, setStartTime] = useState(new Date().toLocaleTimeString());
  const [endDate, setEndDate] = useState(0);
  const [endTime, setEndTime] = useState(new Date().toLocaleTimeString());
  const [choices, setChoices] = useState(['yes', 'no']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef();
  const router = useRouter();
  const activeAccount = useActiveAccount();
  const blockNumber = useBlockNumber({ client, chain: base });

  /**
   * Handles the change event for a choice input field.
   *
   * @param i - The index of the choice in the array.
   * @param event - The change event object.
   */
  function handleChange(i: any, event: any) {
    const values = [...choices];
    values[i] = event.target.value;
    setChoices(values);
  }

  /**
   * Adds an empty choice to the list of choices.
   */
  function handleAdd() {
    const values = [...choices];
    values.push('');
    setChoices(values);
  }

  /**
   * Removes a choice from the list of choices.
   *
   * @param i - The index of the choice to remove.
   */
  function handleRemove(i: any) {
    const values = [...choices];
    values.splice(i, 1);
    setChoices(values);
  }

  /**
   * Submits a vote proposal.
   *
   * @returns {Promise<void>} A promise that resolves when the proposal is created.
   */
  const submit = async () => {
    if (activeAccount) {
      try {
        setIsSubmitting(true);

        // Validate required fields
        if (
          !title ||
          !content ||
          !startDate ||
          !startTime ||
          !endDate ||
          !endTime ||
          choices.length < 2
        ) {
          alert(
            'Please fill in all required fields and provide at least two choices.',
          );
          setIsSubmitting(false);
          return;
        }

        // Initialize Web3 provider
        const web3 = new Web3Provider(window.ethereum);
        const [account] = await web3.listAccounts();

        // Get current block of Polygon network
        const provider = snapshot.utils.getProvider('137'); // Polygon network ID
        const block = await snapshot.utils.getBlockNumber(provider);

        const receipt = await hub_client.proposal(
          client,
          activeAccount?.address,
          {
            space: 'thecreative.eth',
            type: 'single-choice',
            title: title,
            body: content,
            choices: choices,
            start: new Date(`${startDate}T${startTime}`).getTime() / 1000,
            end: new Date(`${endDate}T${endTime}`).getTime() / 1000,
            snapshot: blockNumber,
            plugins: JSON.stringify({
              poap: {},
            }),
            app: 'creative-tv',
          },
        );

        console.log(`created proposal ${receipt.id}`);
        router.push('/vote');
      } catch (error) {
        console.log(error);
        setIsSubmitting(false);
      }
    } else {
      console.log('Please connect your wallet to create a proposal.');
    }
  };

  const changeInput = (event: any, type: string) => {
    if (type === 'title') {
      setTitle(event.target.value);
    } else if (type === 'content') {
      setContent(event.target.value);
    } else if (type === 'start date') {
      setStartDate(event.target.value);
    } else if (type === 'start time') {
      setStartTime(event.target.value);
    } else if (type === 'end time') {
      setEndTime(event.target.value);
    } else if (type === 'end date') {
      setEndDate(event.target.value);
    }
  };

  return (
    <div className="flex flex-wrap items-start justify-center p-2">
      <div className="w-full p-5 md:w-2/5">
        <div className="mb-4 cursor-pointer">
          <div className="rounded-t-3xl bg-gradient-to-l from-yellow-300 via-red-600 to-pink-400 p-4">
            <h2 className="text-md font-bold text-white">Title</h2>
          </div>
          <div className="bg-brand-100 rounded-b-3xl border border-pink-400 p-4">
            <Input
              className="w-full font-bold"
              placeholder="[#BrandName] Campaign Voting"
              onChange={(event) => {
                changeInput(event, 'title');
              }}
            />
          </div>
        </div>
        <div className="mb-4 cursor-pointer">
          <div className="rounded-t-3xl bg-gradient-to-l from-yellow-300 via-red-600 to-pink-400 p-4">
            <h2 className="text-md font-bold text-white">Content</h2>
          </div>
          <div className="bg-brand-100 rounded-b-3xl border border-pink-400 p-4">
            <Textarea
              className="w-full"
              placeholder="Here is a sample placeholder"
              onChange={(event) => {
                changeInput(event, 'content');
              }}
            />
          </div>
        </div>
        <div className="mb-4 cursor-pointer">
          <div className='className="p-4 to-pink-400" rounded-t-3xl bg-gradient-to-l from-yellow-300 via-red-600'>
            <h2 className="text-md font-bold text-white">Choices</h2>
          </div>
          <div className="bg-brand-100 rounded-b-3xl border border-pink-400 p-4">
            <div className="space-y-4">
              <form>
                {choices.map((field, index) => {
                  return (
                    <div className="relative mb-5" key={index}>
                      <Input
                        className="choices w-full"
                        placeholder="Enter Choice"
                        value={field || ''}
                        onChange={(e) => handleChange(index, e)}
                      />
                      <div
                        className="absolute right-0 top-0 cursor-pointer p-2"
                        onClick={() => handleRemove(index)}
                      >
                        <FaWindowClose />
                      </div>
                    </div>
                  );
                })}
              </form>
            </div>

            <Button
              className="mt-4 w-full rounded bg-pink-400 p-2 text-white hover:bg-pink-600 focus:bg-pink-600"
              onClick={() => handleAdd()}
            >
              <h2 className="text-sm font-bold text-white">Add</h2>
            </Button>
          </div>
        </div>
      </div>
      <div className="mt-10 w-full p-5 md:w-2/5">
        <div className="cursor-pointer rounded-t-3xl bg-gradient-to-l from-yellow-300 via-red-600 to-pink-400 p-4">
          <h2 className="text-md font-bold text-white">Actions</h2>
        </div>
        <div className="bg-brand-100 rounded-b-3xl border border-pink-400 p-4">
          <h3 className="text-sm font-bold text-white">Start Date</h3>
          <Input
            type="date"
            className="mt-2 w-full"
            onChange={(event) => {
              changeInput(event, 'start date');
            }}
          />
          <h3 className="text-sm font-bold text-white">Start time</h3>
          <Input
            type="time"
            className="mt-2 w-full"
            onChange={(event) => {
              changeInput(event, 'start time');
            }}
          />
          <h3 className="mt-4 text-sm font-bold text-white">End date</h3>
          <Input
            type="date"
            className="mt-2 w-full"
            onChange={(event) => {
              changeInput(event, 'end date');
            }}
          />
          <h3 className="mt-4 text-sm font-bold text-white">End time</h3>
          <Input
            type="time"
            className="mt-2 w-full"
            onChange={(event) => {
              changeInput(event, 'end time');
            }}
          />
          {isSubmitting ? (
            <Button
              disabled
              className="mt-4 w-full rounded bg-pink-400 p-2 text-white hover:bg-pink-600 focus:bg-pink-600"
            >
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </Button>
          ) : (
            <Button
              className="mt-4 w-full rounded bg-pink-400 p-2 text-white hover:bg-pink-600 focus:bg-pink-600"
              onClick={() => submit()}
            >
              Submit
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
