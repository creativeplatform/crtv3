import {
  getERC20Metadata,
  priceInHumanReadable,
  timestampToDateString,
} from '@app/lib/helpers';
import { videoContract } from '@app/lib/sdk/thirdweb/get-contract';
import { NFT, ResolvedReturnType } from '@app/types/nft';
import { AddIcon, CloseIcon, DeleteIcon, EditIcon } from '@chakra-ui/icons';
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Button,
  ButtonGroup,
} from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ContractOptions, prepareEvent } from 'thirdweb';
import {
  getActiveClaimCondition,
  getClaimConditions,
} from 'thirdweb/extensions/erc1155';
import { GetCurrencyMetadataResult } from 'thirdweb/extensions/erc20';
import { useContractEvents } from 'thirdweb/react';
import AddClaimPhaseButton from '../AddClaimPhase/AddClaimPhaseButton';
import EditClaimConditions from '../edit-claim-conditions/EditClaimConditions';
import SetClaimConditions from '../SetClaimConditions/SetClaimConditions';
import { formatNumber } from '@app/lib/helpers';

type ListClaimConditionsProps = {
  nft: NFT;
  claimConditions: ResolvedReturnType<ReturnType<typeof getClaimConditions>>;
  nftContract: Readonly<ContractOptions<[]>>;
  addClaimPhase: boolean;
  setAddClaimPhase: (arg: boolean) => void;
  processingClaimConditions: boolean;
};

const preparedClaimConditionsUpdatedEvent = prepareEvent({
  signature:
    'event ClaimConditionsUpdated(uint256 indexed tokenId, (uint256 startTimestamp, uint256 maxClaimableSupply, uint256 supplyClaimed, uint256 quantityLimitPerWallet, bytes32 merkleRoot, uint256 pricePerToken, address currency, string metadata)[] claimConditions, bool resetEligibility)',
});

export default function ListClaimConditions(props: ListClaimConditionsProps) {
  const [claimConditions, setClaimConditions] = useState<
    ResolvedReturnType<ReturnType<typeof getClaimConditions>>
  >([]);
  const [isLoadingERCMeta, setIsLoadingERCMeta] = useState(true);
  const [erc20Metadata, setERC20Metadata] = useState<{
    [key: string]: GetCurrencyMetadataResult | null;
  }>({});
  const [processingActiveClaimCondition, setProcessingActiveClaimCondition] =
    useState(false);
  const [activeClaimCondition, setActionClaimCondition] = useState<
    ResolvedReturnType<ReturnType<typeof getActiveClaimCondition>>
  >({
    currency: '0x0',
    maxClaimableSupply: 0n,
    merkleRoot: '',
    pricePerToken: 0n,
    metadata: '',
    quantityLimitPerWallet: 0n,
    startTimestamp: 0n,
    supplyClaimed: 0n,
  });

  const [editStates, setEditStates] = useState<{ [key: number]: boolean }>(
    claimConditions.reduce((acc: { [key: number]: boolean }, _, i) => {
      acc[i] = false;
      return acc;
    }, {}),
  );

  const { data: ccEvents, error: ccErrorEvents } = useContractEvents({
    contract: videoContract,
    events: [preparedClaimConditionsUpdatedEvent],
  });

  const fetchERC20Metadata = async (currencyAddress: string) => {
    try {
      const data = await getERC20Metadata(currencyAddress);
      setERC20Metadata((prvmtd) => ({ ...prvmtd, [currencyAddress]: data }));
    } catch (err) {
      // TODO: find how an error state might be useful
      throw new Error(
        `Error fetching currency metadata: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    } finally {
      setIsLoadingERCMeta(false);
    }
  };

  const updateERC20Metadata = useCallback(async () => {
    const currencies = claimConditions
      .map((cc) => cc.currency)
      .filter((c) => Boolean(c) && !erc20Metadata[c]);

    await Promise.all(currencies.map((c) => fetchERC20Metadata(c)));
  }, [claimConditions, erc20Metadata]);

  useEffect(() => {
    setClaimConditions([...props.claimConditions]);
  }, [props.claimConditions]);

  useEffect(() => {
    updateERC20Metadata();
  }, [erc20Metadata, updateERC20Metadata, ccEvents]);

  useEffect(() => {
    if (ccEvents && ccEvents.length > 0) {
      const { claimConditions } = ccEvents[0].args;
      setClaimConditions([...claimConditions]);
    }
  }, [ccEvents]);

  useEffect(() => {
    const fetchActiveClaimCondition = async (tokenId: bigint) => {
      setProcessingActiveClaimCondition(true);

      try {
        const activeCC = await getActiveClaimCondition({
          contract: videoContract,
          tokenId,
        });

        if (activeCC) {
          setProcessingActiveClaimCondition(false);
          setActionClaimCondition(activeCC);
        }
      } catch (err) {
        setProcessingActiveClaimCondition(false);
      }
    };

    fetchActiveClaimCondition(props.nft.id);
  }, [props.nft.id]);

  const isActiveClaimPhase = useMemo(
    () => (startTimestamp: bigint) =>
      activeClaimCondition.startTimestamp === startTimestamp,
    [activeClaimCondition.startTimestamp],
  );

  const toggleEditClaim = (idx: number) => {
    setEditStates((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const deleteClaimById = async (tokenId: string) => {
    // TODO: stub to delete a claim by id
    console.log('deleteClaimById: ', tokenId);
  };

  return (
    <>
      <div className="my-8 text-slate-300">
        <p className="mb-1 text-lg text-slate-200">Set Claim Conditions</p>
        <p className="mb-2 text-sm">
          <em> Condition how your NFTs can be claimed</em>
        </p>
      </div>

      {claimConditions.length > 0 ? (
        <>
          <div className="mb-6">
            <p className="mb-0 text-lg text-slate-400">
              Claims for token ID: #{props.nft.id.toString()}
            </p>
            <p className="text-sm text-slate-300">
              Any wallet can claim this token
            </p>
          </div>

          {claimConditions.map((cc, i) => (
            <div
              key={`claim-${cc.startTimestamp.toString()}`}
              className="mx-auto mb-4 w-full max-w-screen-xl rounded-lg border bg-slate-700 p-6"
            >
              <div className={`mb-5 flex flex-row justify-between`}>
                <p className="self-start">
                  Public{' '}
                  {isActiveClaimPhase(cc.startTimestamp) && (
                    <span className="rounded-sm bg-green-100 p-1 text-xs font-medium text-green-700">
                      Active
                    </span>
                  )}
                </p>

                <ButtonGroup variant="outline" className="self-end">
                  <Button
                    className="text-sm"
                    colorScheme=""
                    variant="ghost"
                    disabled={true} // TODO: Need to visit when update claim condition function is resolved
                    leftIcon={
                      editStates[i] ? (
                        <CloseIcon boxSize={3} />
                      ) : (
                        <EditIcon boxSize={3} />
                      )
                    }
                    onClick={() => {
                      return; // FIXME: Remove when update claim condition function is resolved
                      // toggleEditClaim(i);
                    }}
                  >
                    {editStates[i] ? 'Cancel' : 'Edit'}
                  </Button>
                  <Button
                    className="text-sm"
                    leftIcon={<DeleteIcon boxSize={3} />}
                    onClick={() => deleteClaimById(props.nft.id.toString())}
                  >
                    Delete
                  </Button>
                </ButtonGroup>
              </div>

              {editStates[i] ? (
                <EditClaimConditions
                  videoContract={videoContract}
                  nft={props.nft}
                  ccIndex={i}
                  claimConditions={claimConditions}
                  setCanEditClaim={toggleEditClaim}
                />
              ) : (
                <div className="flex flex-row justify-between">
                  <div>
                    <p className="mb-1 text-sm font-medium text-slate-200">
                      Start time
                    </p>
                    <span className="text-sm text-slate-300">
                      {timestampToDateString(cc.startTimestamp)}
                    </span>
                  </div>
                  <div>
                    <p className="mb-1 text-sm font-medium text-slate-200">
                      Num to drop
                    </p>
                    <span className="text-sm text-slate-300">
                      {cc.maxClaimableSupply.toString()}
                    </span>
                  </div>
                  <div>
                    <p className="mb-1 text-sm font-medium text-slate-200">
                      Price
                    </p>
                    {erc20Metadata[cc.currency] ? (
                      <span className="text-sm text-slate-300">
                        {priceInHumanReadable(
                          cc.pricePerToken,
                          Number(erc20Metadata[cc.currency]?.decimals),
                        )}{' '}
                        {erc20Metadata[cc.currency]?.symbol ?? 'Loading'}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-300">Loading...</span>
                    )}
                  </div>
                  <div>
                    <p className="mb-1 text-sm font-medium text-slate-200">
                      Limit per wallet
                    </p>
                    <span className="text-sm text-slate-300">
                      {cc.quantityLimitPerWallet.toString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}

          {!props.addClaimPhase && (
            <AddClaimPhaseButton
              label={!props.addClaimPhase ? 'Add Claim Phase' : 'Cancel'}
              addClaimPhase={props.addClaimPhase}
              setAddClaimPhase={props.setAddClaimPhase}
            />
          )}
        </>
      ) : (
        <div className="mx-auto mb-20 flex flex-col space-y-4">
          <Alert
            status="error"
            variant="subtle"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            textAlign="center"
            height="200px"
            borderRadius={4}
          >
            <AlertIcon
              boxSize="40px"
              className="mb-4 mr-0 rounded-full bg-red-500"
            />
            <AlertTitle className="mb-1 text-base text-slate-100">
              Claim Conditions not set
            </AlertTitle>
            <AlertDescription className="text-sm text-slate-300">
              <em className="text-slate-300">
                You need to set at least one claim condition to enable persons
                to claim this nft.
              </em>
            </AlertDescription>
          </Alert>

          {!props.addClaimPhase && (
            <Button
              variant="outline"
              className="bottom-1 rounded border border-slate-300 px-4 py-2 text-base font-medium text-white"
              colorScheme={props.addClaimPhase ? 'red' : ''}
              leftIcon={
                !props.addClaimPhase ? (
                  <AddIcon fontSize={10} />
                ) : (
                  <CloseIcon fontSize={10} />
                )
              }
              onClick={() => {
                props.setAddClaimPhase &&
                  props.setAddClaimPhase(!props.addClaimPhase);
              }}
            >
              {!props.addClaimPhase ? 'Add Claim Phase' : 'Cancel'}
            </Button>
          )}
        </div>
      )}
      {props.addClaimPhase && (
        <SetClaimConditions
          numberOfClaimsConditonsAvailable={claimConditions.length}
          nft={props.nft}
          setAddClaimPhase={props.setAddClaimPhase}
          claimConditions={claimConditions}
        />
      )}
    </>
  );
}
