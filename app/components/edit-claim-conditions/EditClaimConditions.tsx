import {
  claimConditionsOptions,
  timestampToInputDateString,
} from '@app/lib/helpers/helpers';
import { NFT, ResolvedReturnType } from '@app/types/nft';
import {
  Box,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Select,
  useToast,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { ContractOptions } from 'thirdweb';
import { getClaimConditions } from 'thirdweb/extensions/erc1155';

type EditClaimFormData = {
  currency: string;
  phaseName: string;
  maxClaimablePerWallet: string;
  maxClaimableSupply?: string;
  startTimestamp: string;
  // waitInSeconds: string;
};

type EditClaimConditionsProps = {
  nft: NFT;
  ccIndex: number;
  claimConditions: ResolvedReturnType<ReturnType<typeof getClaimConditions>>;
  videoContract: Readonly<ContractOptions<[]>>;
  setCanEditClaim: (arg: number) => void;
};

export default function EditClaimConditions(props: EditClaimConditionsProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isErrorFree, setIsErrorFree] = useState(false);
  const [isExecuted, setIsExecuted] = useState(false); // to clear form data

  const toast = useToast();
  const cc = props.claimConditions[props.ccIndex];

  const handleUpdateClaimCondition = async (
    tokenId: bigint,
    ccIndex: number,
    formData: EditClaimFormData,
  ): Promise<boolean | undefined> => {
    // update an existing claimCondition by its id

    try {
      // await props.nftContract?.erc1155.claimConditions.update(
      //   tokenId,
      //   ccIndex,
      //   {
      //     startTime: formData.startTimestamp, // When the phase starts (i.e. when users can start claiming tokens)
      //     maxClaimableSupply: formData.maxClaimableSupply, // limit how many mints for this presale
      //     currency: formData.currency, // The address of the currency you want users to pay in
      //     maxClaimablePerWallet: formData.maxClaimablePerWallet, // The maximum number of tokens a wallet can claim
      //     metadata: {
      //       name: formData.phaseName, // Name of the sale's phase
      //     },
      //     // waitInSeconds: formData.waitInSeconds, // How long a buyer waits before another purchase is possible
      //   },
      // );

      return true;
    } catch (err) {
      console.error({ err });

      toast({
        title: 'Set Claim Conditions',
        description: `Failed to set claim conditions`,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const sumbitUpdatedCC: SubmitHandler<EditClaimFormData> = async (data) => {
    const { errors } = formState;

    console.log('form submitting...');

    const isRequiredFields =
      errors.maxClaimablePerWallet?.type === 'required' ||
      errors.currency?.type === 'required' ||
      errors.phaseName?.type === 'required' ||
      errors.startTimestamp?.type === 'required';
    // || errors.waitInSeconds?.type === 'required';

    if (isRequiredFields) {
      return;
    }

    const dateObj = new Date(data.startTimestamp);

    const formData = {
      ...data,
      maxClaimablePerWallet: data.maxClaimablePerWallet,
      // waitInSeconds: data.waitInSeconds,
      startTimestamp: dateObj.getTime(),
    };

    try {
      setIsErrorFree(true);
      setIsSubmitting(true);

      // TODO: remove after debugging
      console.log({ formData });

      // await handleUpdateClaimCondition(props.nft.id, props.ccIndex, formData);
    } catch (err: any) {
      setIsSubmitting(false);
      console.error(err);
      toast({
        title: 'Set Claim Conditions',
        description: `Setting claim conditions failed!`,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    }
  };

  const {
    handleSubmit,
    control: ctrl,
    formState,
    register,
  } = useForm<EditClaimFormData>();

  return (
    <Box my={8}>
      <form onSubmit={handleSubmit(sumbitUpdatedCC)} id="updateClaimCondtion">
        <FormControl
          mb={8}
          isDisabled={isErrorFree && isSubmitting}
          defaultValue={''}
        >
          <div className="my-6 flex flex-col gap-2">
            {/* <div alignItems={'flex-start'}>
              <FormLabel>Name of Phase</FormLabel>
              <Controller
                name="phaseName"
                control={ctrl}
                rules={{ required: true }}
                render={({ field }) => (
                  <Input
                    color={'gray.300'}
                    defaultValue={cc.metadata?.name || ''}
                    size={'lg'}
                    {...register('phaseName')}
                    mb={formState.errors.phaseName ? 0 : 4}
                    placeholder="Enter name to for this phase (Phase 1)"
                    aria-invalid={formState.errors.phaseName ? 'true' : 'false'}
                    value={field.value}
                  />
                )}
              />
              {formState.errors.phaseName?.type === 'required' && (
                <FormHelperText className="text-red-500 mb-8">
                  Select a name for the phase of sales.
                </FormHelperText>
              )}
            </div> */}
            <div className="flex flex-col gap-1">
              <FormLabel>Start time of Phase</FormLabel>
              <Controller
                name="startTimestamp"
                control={ctrl}
                rules={{ required: true }}
                render={({ field }) => {
                  return (
                    <Input
                      {...field}
                      minW={200}
                      type="datetime-local"
                      {...register('startTimestamp')}
                      value={
                        field.value ||
                        timestampToInputDateString(cc.startTimestamp)
                      }
                      onChange={(e) => field.onChange(e.target.value)}
                      className=" dark:text-gray-500"
                      size={'lg'}
                      mb={formState.errors.startTimestamp ? 0 : 4}
                      placeholder="Start time of Phase"
                      aria-invalid={
                        formState.errors.startTimestamp ? 'true' : 'false'
                      }
                    />
                  );
                }}
              />
              {formState.errors.startTimestamp?.type === 'required' && (
                <FormHelperText className="mb-8 text-red-500">
                  When the phase starts (i.e. when users can start claiming
                  tokens).
                </FormHelperText>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <FormLabel>Select Payment Currency</FormLabel>
              <Controller
                name="currency"
                control={ctrl}
                rules={{ required: true }}
                render={({ field }) => {
                  return (
                    <Select
                      defaultValue={cc.currency}
                      className="min-w-20 dark:text-gray-500"
                      placeholder=""
                      size={'lg'}
                      {...register('currency')}
                      aria-invalid={
                        formState.errors.currency ? 'true' : 'false'
                      }
                    >
                      <option value="">--- Select currency ---</option>
                      {Object.keys(claimConditionsOptions.currency).map(
                        (key, i) => {
                          return (
                            <option
                              key={i}
                              value={
                                Object.values(claimConditionsOptions.currency)[
                                  i
                                ]
                              }
                            >
                              {key}
                            </option>
                          );
                        },
                      )}
                    </Select>
                  );
                }}
              />

              {formState.errors.currency?.type === 'required' && (
                <FormHelperText className="mb-8 text-red-500">
                  Select a purchasing currency
                </FormHelperText>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <FormLabel>Maximum purchase per Wallet </FormLabel>
              <Controller
                name="maxClaimablePerWallet"
                control={ctrl}
                rules={{ required: true }}
                render={({ field }) => (
                  <Input
                    className="dark:text-gray-500"
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
                    defaultValue={cc.quantityLimitPerWallet.toLocaleString()}
                  />
                )}
              />
              {formState.errors.maxClaimablePerWallet?.type === 'required' && (
                <FormHelperText className="mb-8 text-red-500">
                  The maximum number of tokens a wallet can claim.
                </FormHelperText>
              )}
            </div>
          </div>
        </FormControl>

        <Button
          type="submit"
          _hover={{
            color: 'gray.300',
            cursor: isSubmitting ? 'progress' : 'pointer',
          }}
          className="my-3 w-40 bg-[--color-brand-red] text-white"
          isLoading={isSubmitting}
          loadingText={isSubmitting ? 'Saving' : ''}
        >
          Save
        </Button>
      </form>
    </Box>
  );
}
