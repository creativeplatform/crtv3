import { videoContract } from '@app/lib/sdk/thirdweb/get-contract';
import { NFT, ResolvedReturnType } from '@app/types/nft';
import { AddIcon, CloseIcon, DeleteIcon, EditIcon } from '@chakra-ui/icons';
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Button,
  ButtonGroup,
  Spacer,
  Stack,
  VStack,
} from '@chakra-ui/react';
import { ethers } from 'ethers';
import { useState } from 'react';
import { prepareEvent } from 'thirdweb';
import { getClaimConditions } from 'thirdweb/extensions/erc1155';
import { useContractEvents } from 'thirdweb/react';
import AddClaimPhaseButton from '../AddClaimPhase/AddClaimPhaseButton';
// import { parseCurrencyDecimals } from 'utils/helpers';

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

  const { data: ccEvents, error: ccErrorEvents } = useContractEvents({
    contract: videoContract,
    events: [preparedClaimConditionsUpdatedEvent],
  });

  const deleteClaimById = async (tokenId: string) => {
    // TODO: stub to delete a claim by id
    console.log('deleteClaimById: ', tokenId);
  };

  const isActiveClaimPhase = (date: Date) => {
    return new Date().getTime() > new Date(date).getTime();
  };

  return (
    <>
      <div className="mb-6 text-slate-300">
        <p className="mb-1 text-lg text-slate-200">Set Claim Conditions</p>
        <p className="mb-2 text-sm">
          <em> Condition how your NFTs can be claimed</em>
        </p>
      </div>

      <VStack className="rounded-md border border-solid border-slate-300 p-16">
        {props.claimConditions && props.claimConditions.length > 0 ? (
          <>
            <VStack alignItems={'flex-start'} spacing={0} mb={4}>
              <p>Claims for token ID: #{props.nft.id}</p>
              <p className="text-slate-300">Any wallet can claim this token</p>
            </VStack>

            {props.claimConditions.map((cc, i) => (
              <div
                key={i}
                className="border-radius-4 mb-1 border bg-slate-600 p-4"
              >
                <Stack
                  className="header"
                  direction={'row'}
                  alignItems={'flex-start'}
                >
                  {isActiveClaimPhase(
                    new Date(cc.startTimestamp.toString()),
                  ) && (
                    <Badge
                      variant="solid"
                      alignContent={'center'}
                      size={'sm'}
                      colorScheme="green"
                    >
                      Active
                    </Badge>
                  )}

                  <Spacer />
                  <ButtonGroup variant="outline">
                    <Button
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
                      colorScheme="red"
                      variant="ghost"
                      leftIcon={<DeleteIcon boxSize={3} />}
                      onClick={() => deleteClaimById(props.nft.id.toString())}
                    >
                      Delete
                    </Button>
                  </ButtonGroup>
                </Stack>

                {canEditClaim ? (
                  //   <EditClaimConditions
                  //     nftContract={props.nftContract}
                  //     nft={props.nft}
                  //     ccIndex={i}
                  //     claimCondition={props.claimConditions[i]}
                  //     setCanEditClaim={setCanEditClaim}
                  //   />
                  <p>Can edit here</p>
                ) : (
                  <h4>Show here</h4>
                  //   <div className="body" key={c .startTime.toDateString()}>
                  //     <HStack spacing="24px" style={{ fontSize: '14px' }}>
                  //       <div>
                  //         <p style={{ fontWeight: 600, marginBottom: '12px' }}>
                  //           Name
                  //         </p>
                  //         <span>{c.metadata?.name}</span>
                  //       </div>
                  //       <div>
                  //         <p style={{ fontWeight: 600, marginBottom: '12px' }}>
                  //           Start time
                  //         </p>
                  //         <span>{c.startTime.toDateString()}</span>
                  //       </div>
                  //       <div>
                  //         <p style={{ fontWeight: 600 }}>Num to drop</p>
                  //         <span>{c.availableSupply}</span>
                  //       </div>
                  //       <div>
                  //         <p style={{ fontWeight: 600 }}>Price</p>
                  //         {/* {parseCurrencyDecimals(
                  //           c.price as any,
                  //           c.currencyMetadata.decimals,
                  //         )} */}{' '}
                  //         0<span>{c.currencyMetadata.symbol}</span>
                  //       </div>
                  //       <div>
                  //         <p style={{ fontWeight: 600 }}>
                  //           Limit per wallet
                  //         </p>
                  //         <span>{c.maxClaimablePerWallet}</span>
                  //       </div>
                  //     </HStack>
                  //   </div>
                )}
              </div>
            ))}
          </>
        ) : (
          <>
            {/* {props.addClaimPhase && ( */}
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
                <AlertIcon boxSize="40px" mr={0} mb={4} />
                <AlertTitle className="mb-1 mt-4 text-base">
                  Claim Conditions not set
                </AlertTitle>
                <AlertDescription className="text-sm text-slate-300">
                  <em>
                    You need to set at least one claim condition to enable
                    persons to claim this nft.
                  </em>
                </AlertDescription>
              </Alert>

              <Button
                variant="outline"
                fontSize={12}
                colorScheme={props.addClaimPhase ? 'red' : ''}
                leftIcon={
                  !props.addClaimPhase ? (
                    <AddIcon fontSize={10} />
                  ) : (
                    <CloseIcon fontSize={10} />
                  )
                }
                onClick={() => {
                  console.log('props.addClaimPhase: ', props.addClaimPhase);
                  props.setAddClaimPhase!(!props.addClaimPhase);
                }}
              >
                {!props.addClaimPhase ? 'Add Claim Phase' : 'Cancel'}
              </Button>
            </VStack>
            {/* )} */}
          </>
        )}

        {props.claimConditions.length > 0 && (
          <AddClaimPhaseButton
            children={!props.addClaimPhase ? 'Add Claim Phase' : 'Cancel'}
            addClaimPhase={props.addClaimPhase!}
            setAddClaimPhase={props.setAddClaimPhase!}
          />
        )}
      </VStack>
    </>
  );
}
