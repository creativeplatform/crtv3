import { useEffect, useState } from 'react';
import { ContractOptions } from 'thirdweb';
import {
  getActiveClaimCondition,
  GetActiveClaimConditionParams,
} from 'thirdweb/extensions/erc1155';

type ActiveClaimCondition = {
  contract: Readonly<ContractOptions<any>>;
} & GetActiveClaimConditionParams;

export function useActiveClaimCondition(props: ActiveClaimCondition) {
  const [activeClaimCondition, setActiveClaimCondition] = useState<
    ActiveClaimCondition | Record<string, unknown>
  >();
  const [error, setError] = useState<Error>();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const getActiveCC = async () => {
      try {
        setIsLoading(true);
        const res = await getActiveClaimCondition({
          contract: props.contract,
          tokenId: props.tokenId,
        });

        if (mounted) {
          setActiveClaimCondition(res);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    getActiveCC();

    return () => {
      mounted = false;
    };
  }, [props.contract, props.tokenId]);

  return {
    data: activeClaimCondition,
    error,
    isLoading,
  };
}
