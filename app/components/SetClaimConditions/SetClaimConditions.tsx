import { claimConditionsOptions } from '@app/lib/helpers/helpers';
import { videoContract } from '@app/lib/sdk/thirdweb/get-contract';
import { NFT, ResolvedReturnType } from '@app/types/nft';
import {
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Select,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { ethers } from 'ethers';
import { useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { sendTransaction } from 'thirdweb';
import {
  getClaimConditions,
  setClaimConditions,
} from 'thirdweb/extensions/erc1155';
import { useActiveAccount } from 'thirdweb/react';

type ClaimFormData = {
  price: bigint;
  currencyAddress: string;
  phaseName: string | undefined;
  maxClaimablePerWallet: string | number;
  maxClaimableSupply: bigint | number;
  startTime: string | number;
  waitInSeconds: string | number;
};

type SetClaimConditionsProps = {
  nft: NFT;
  contractMetadata?: string;
  numberOfClaimsConditonsAvailable: number;
  setAddClaimPhase: (arg: boolean) => void;
  claimConditions: ResolvedReturnType<ReturnType<typeof getClaimConditions>>; // needed to be included with the new claimCondition
  getClaimConditionsById?: (tokenId: string) => void;
};

//
export default function SetClaimConditions(props: SetClaimConditionsProps) {
  const activeAccount = useActiveAccount();
  const [isSettingCC, setIsSettingCC] = useState(false);
  const [isErrorFree, setIsErrorFree] = useState(false);
  const [ccError, SetCCError] = useState<Error>();
  const [txStatus, setTxStatus] = useState<number | undefined>(0);
  const toast = useToast();

  const {
    handleSubmit,
    control: ctrl,
    formState,
    register,
  } = useForm<ClaimFormData>();

  const handleSetCC = async (
    formData: ClaimFormData,
    tokenId: bigint,
  ): Promise<ethers.TransactionReceipt | `0x${string}` | void> => {
    //
    const previousCCs =
      props.claimConditions.length > 0
        ? props.claimConditions?.map((cc) => {
            return {
              ...cc,
              price: cc.pricePerToken.toString(),
            };
          })
        : [];

    const claimConditionsInput = {
      currencyAddress: formData.currencyAddress,
      maxClaimablePerWallet: BigInt(formData.maxClaimablePerWallet),
      maxClaimableSupply: BigInt(formData.maxClaimableSupply),
      price: props.nft.metadata.properties.price.toString(),
      startTime: new Date(formData.startTime),
      metadata: {
        name: formData.phaseName,
      },
    };

    console.log({ claimConditionsInput });

    try {
      setIsSettingCC(true);

      const transaction = setClaimConditions({
        contract: videoContract,
        tokenId,
        phases: [
          // TODO: At the moment; to add new claimCondition, you must batch the
          // previous claimConditions with the new claimCondition
          // ...previousCCs!,
          {
            ...claimConditionsInput,
          },
        ],
        resetClaimEligibility: false,
      });

      const { transactionHash } = await sendTransaction({
        transaction,
        account: activeAccount!!,
      });

      return transactionHash;
    } catch (err) {
      setIsSettingCC(false);
      console.error(err);
      throw err;
    }
  };

  const handleSubmitCCs: SubmitHandler<ClaimFormData> = async (data) => {
    const { errors } = formState;

    const isRequiredFields =
      errors.maxClaimablePerWallet?.type === 'required' ||
      errors.currencyAddress?.type === 'required' ||
      errors.maxClaimableSupply?.type === 'required' ||
      errors.phaseName?.type === 'required' ||
      errors.startTime?.type === 'required' ||
      errors.waitInSeconds?.type === 'required';

    if (isRequiredFields) {
      return;
    }

    const formatData: ClaimFormData = {
      ...data,
      waitInSeconds: data.waitInSeconds,
      startTime: data.startTime?.toString(),
      price: props.nft.metadata.properties.price,
      maxClaimablePerWallet: data.maxClaimablePerWallet,
      maxClaimableSupply: props.nft.metadata.properties.amount,
    };

    console.log('handleSetCC::formatData', formatData);

    try {
      setIsErrorFree(true);
      setIsSettingCC(true);

      const txnHash = await handleSetCC(formatData, props.nft.id);
      if (txnHash) {
        setIsSettingCC(false);
        setTxStatus(1);

        toast({
          title: 'Set Claim Conditions',
          description: `Successful with status: ${1}`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (err: any) {
      console.error('handleSetClaimCondition', err);
      setIsSettingCC(false);
      SetCCError(err);
      toast({
        title: 'Set Claim Conditions',
        description: `Setting claim conditions failed!`,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    }
  };

  return (
    <div className="my-4 rounded-md border border-solid border-slate-500 p-8">
      <h4 className="py-4 text-xl font-medium text-slate-300">
        Set conditions for the sale/claim of your NFT(s)
      </h4>
      <form
        className="mt-4 font-normal text-slate-400"
        onSubmit={handleSubmit(handleSubmitCCs)}
        id="setClaimCondtion"
      >
        <FormControl isDisabled={isErrorFree && isSettingCC}>
          <div className="flex flex-col gap-4">
            <VStack alignItems={'flex-start'}>
              <FormLabel>Name of Phase</FormLabel>
              <Controller
                name="phaseName"
                control={ctrl}
                rules={{ required: true }}
                render={({ field }) => (
                  <Input
                    color={'gray.300'}
                    errorBorderColor="red.300"
                    defaultValue={
                      `Phase ${props.numberOfClaimsConditonsAvailable + 1}` ||
                      ''
                    }
                    size="lg"
                    {...register('phaseName')}
                    mb={formState.errors.phaseName ? 0 : 4}
                    placeholder="Enter name to for this phase (Phase One)"
                    aria-invalid={formState.errors.phaseName ? 'true' : 'false'}
                    value={field.value}
                  />
                )}
              />
              {formState.errors.phaseName?.type === 'required' && (
                <FormHelperText mb="32px" color={'red.500'}>
                  Select a name for the phase of sales.
                </FormHelperText>
              )}
            </VStack>
            <VStack alignItems={'flex-start'}>
              <FormLabel>Start time of Phase</FormLabel>
              <Controller
                name="startTime"
                control={ctrl}
                rules={{ required: true }}
                render={({ field }) => (
                  <Input
                    color={'gray.300'}
                    minW={200}
                    {...register('startTime')}
                    type="datetime-local"
                    size={'lg'}
                    mb={formState.errors.startTime ? 0 : 4}
                    placeholder="Start date and time of Phase"
                    aria-invalid={formState.errors.startTime ? 'true' : 'false'}
                  />
                )}
              />
              {formState.errors.startTime?.type === 'required' && (
                <FormHelperText mb="32px" color={'red.500'}>
                  When the phase starts (i.e. when users can start claiming
                  tokens).
                </FormHelperText>
              )}
            </VStack>

            <VStack alignItems={'flex-start'}>
              <FormLabel>Select Payment Currency</FormLabel>
              <Controller
                name="currencyAddress"
                control={ctrl}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    color={'gray.300'}
                    placeholder=""
                    size={'lg'}
                    {...register('currencyAddress')}
                    aria-invalid={
                      formState.errors.currencyAddress ? 'true' : 'false'
                    }
                  >
                    <option value="">Select currency</option>
                    {Object.keys(claimConditionsOptions.currency).map(
                      (c, i) => (
                        <option
                          key={i}
                          value={
                            Object.values(claimConditionsOptions.currency)[i]
                          }
                        >
                          {c}
                        </option>
                      ),
                    )}
                  </Select>
                )}
              />
              {formState.errors.currencyAddress?.type === 'required' && (
                <FormHelperText mb="32px" color={'red.500'}>
                  Select a purchasing currency
                </FormHelperText>
              )}
            </VStack>

            <VStack alignItems={'flex-start'}>
              <FormLabel>Cool down period for a buyer to repurchase</FormLabel>
              <Controller
                name="waitInSeconds"
                control={ctrl}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    placeholder=""
                    color={'gray.300'}
                    size={'lg'}
                    {...register('waitInSeconds')}
                    aria-invalid={
                      formState.errors.waitInSeconds ? 'true' : 'false'
                    }
                  >
                    {Object.keys(
                      claimConditionsOptions.waitInSecondsOptions,
                    ).map((time, i) => (
                      <option
                        key={i}
                        value={
                          Object.values(
                            claimConditionsOptions.waitInSecondsOptions,
                          )[i]
                        }
                      >
                        {time}
                      </option>
                    ))}
                  </Select>
                )}
              />
              {formState.errors.waitInSeconds?.type === 'required' && (
                <FormHelperText mb="32px" color={'red.500'}>
                  The period of time users must wait between repeat claims.
                </FormHelperText>
              )}
            </VStack>

            <VStack alignItems={'flex-start'}>
              <FormLabel>Maximum purchase per Wallet </FormLabel>
              <Controller
                name="maxClaimablePerWallet"
                control={ctrl}
                rules={{ required: true }}
                render={({ field }) => (
                  <Input
                    color={'gray.300'}
                    type="number"
                    {...register('maxClaimablePerWallet')}
                    min={1}
                    max={5}
                    size={'lg'}
                    mb={formState.errors.maxClaimablePerWallet ? 0 : 4}
                    placeholder="The maximum number of tokens a wallet can claim"
                    aria-invalid={
                      formState.errors.maxClaimablePerWallet ? 'true' : 'false'
                    }
                    value={field.value}
                  />
                )}
              />
              {formState.errors.maxClaimablePerWallet?.type === 'required' && (
                <FormHelperText mb="32px" color={'red.500'}>
                  The maximum number of tokens a wallet can claim.
                </FormHelperText>
              )}
            </VStack>
          </div>
        </FormControl>

        <Button
          type="submit"
          _hover={{
            color: 'gray.300',
            cursor: isSettingCC ? 'progress' : 'pointer',
          }}
          className="{min-w-4 hover:} my-6 bg-[--color-brand-red] p-3 text-slate-100 hover:text-slate-500"
          isLoading={isSettingCC}
          loadingText={isSettingCC ? 'Submitting...' : ''}
          mb={20}
        >
          Set Conditions
        </Button>
      </form>
    </div>
  );
}
