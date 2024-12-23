import {
  getERC20Metadata,
  parseCurrencyDecimals,
  timestampToDateString,
} from '@app/lib/helpers/helpers';
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
  VStack,
} from '@chakra-ui/react';
import { ethers } from 'ethers';
import { useEffect, useState } from 'react';
import { prepareEvent } from 'thirdweb';
import { getClaimConditions } from 'thirdweb/extensions/erc1155';
import { GetCurrencyMetadataResult } from 'thirdweb/extensions/erc20';
import { useContractEvents } from 'thirdweb/react';
import AddClaimPhaseButton from '../AddClaimPhase/AddClaimPhaseButton';
import EditClaimConditions from '../edit-claim-conditions/EditClaimConditions';

type ListClaimConditionsProps = {
  nft: NFT;
  claimConditions: ResolvedReturnType<ReturnType<typeof getClaimConditions>>;
  nftContract: ethers.BaseContract | undefined | any;
  addClaimPhase?: boolean;
  setAddClaimPhase?: (arg: boolean) => void;
  processingClaimConditions: boolean;
};

const preparedClaimConditionsUpdatedEvent = prepareEvent({
  signature:
    'event ClaimConditionsUpdated(uint256 indexed tokenId, (uint256 startTimestamp, uint256 maxClaimableSupply, uint256 supplyClaimed, uint256 quantityLimitPerWallet, bytes32 merkleRoot, uint256 pricePerToken, address currency, string metadata)[] claimConditions, bool resetEligibility)',
});

export default function ListClaimConditions(props: ListClaimConditionsProps) {
  const [canEditClaim, setCanEditClaim] = useState(false);
  const [isLoadingERCMeta, setIsLoadingERCMeta] = useState(true);
  const [erc20Metadata, setERC20Metadata] = useState<{
    [key: string]: GetCurrencyMetadataResult | null;
  }>({});

  const { data: ccEvents, error: ccErrorEvents } = useContractEvents({
    contract: videoContract,
    events: [preparedClaimConditionsUpdatedEvent],
  });

  console.log({ cc: props.claimConditions });

  const deleteClaimById = async (tokenId: string) => {
    // TODO: stub to delete a claim by id
    console.log('deleteClaimById: ', tokenId);
  };

  const isActiveClaimPhase = (startTimestamp: bigint) => {
    const now = new Date();
    return now.getTime() > Number(startTimestamp.toString());
  };

  const fetchERC20Metadata = async (currencyAddress: string) => {
    try {
      const data = await getERC20Metadata(currencyAddress);
      setERC20Metadata((prvmtd) => ({ ...prvmtd, [currencyAddress]: data }));
    } catch (err: any) {
      throw new Error('Error fetching currency metadata');
    } finally {
      setIsLoadingERCMeta(false);
    }
  };

  useEffect(() => {
    props.claimConditions.forEach((cc) => {
      if (cc.currency && !erc20Metadata[cc.currency]) {
        fetchERC20Metadata(cc.currency);
      }
    });
  }, [props.claimConditions, erc20Metadata]);

  useEffect(() => {
    if (ccEvents) {
      console.log('ccEvents: ', ccEvents);
    }
  }, [ccEvents]);

  return (
    <>
      <div className="mb-6 text-slate-300">
        <p className="mb-1 text-lg text-slate-200">Set Claim Conditions</p>
        <p className="mb-2 text-sm">
          <em> Condition how your NFTs can be claimed</em>
        </p>
      </div>

      {props.claimConditions && props.claimConditions.length > 0 ? (
        <>
          <div className="mb-6">
            <p className="mb-0 text-lg text-slate-400">
              Claims for token ID: #{props.nft.id.toString()}
            </p>
            <p className="text-sm text-slate-300">
              Any wallet can claim this token
            </p>
          </div>

          {props.claimConditions.map((cc, i) => (
            <div
              key={i}
              className="mx-auto mb-4 w-full max-w-screen-xl rounded-lg border bg-slate-700 p-6"
            >
              <div className="mb-4 flex flex-row justify-between">
                {isActiveClaimPhase(cc.startTimestamp) && (
                  <span className="rounded-sm bg-green-100 p-1 text-xs font-medium text-green-700">
                    Active
                  </span>
                )}

                <ButtonGroup variant="outline">
                  <Button
                    className="text-sm"
                    colorScheme=""
                    variant="ghost"
                    leftIcon={
                      canEditClaim ? (
                        <CloseIcon boxSize={3} />
                      ) : (
                        <EditIcon boxSize={3} />
                      )
                    }
                    onClick={() => setCanEditClaim(!canEditClaim)}
                  >
                    {canEditClaim ? 'Cancel Edit' : 'Edit'}
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

              {canEditClaim ? (
                <EditClaimConditions
                  videoContract={videoContract}
                  nft={props.nft}
                  ccIndex={i}
                  claimConditions={props.claimConditions}
                  setCanEditClaim={setCanEditClaim}
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
                        {parseCurrencyDecimals(
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
        </>
      ) : (
        <VStack spacing={8}>
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

          <Button
            variant="outline"
            className="bottom-1 border border-slate-400 p-2 text-sm font-medium"
            colorScheme={props.addClaimPhase ? 'red' : ''}
            leftIcon={
              !props.addClaimPhase ? (
                <AddIcon fontSize={10} />
              ) : (
                <CloseIcon fontSize={10} />
              )
            }
            onClick={() => {
              props.setAddClaimPhase!(!props.addClaimPhase);
            }}
          >
            {!props.addClaimPhase ? 'Add Claim Phase' : 'Cancel'}
          </Button>
        </VStack>
      )}

      {props.claimConditions.length > 0 && (
        <AddClaimPhaseButton
          label={!props.addClaimPhase ? 'Add Claim Phase' : 'Cancel'}
          addClaimPhase={props.addClaimPhase!}
          setAddClaimPhase={props.setAddClaimPhase!}
        />
      )}
    </>
  );
}
