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
    ActiveClaimCondition | {}
  >();
  const [error, setError] = useState<Error>();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const getActiveCC = async () => {
      try {
        setIsLoading(true);
        const res = await getActiveClaimCondition({
          contract: props.contract,
          tokenId: props.tokenId,
        });

        setActiveClaimCondition(res);
      } catch (err: any) {
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    getActiveCC();
  }, [props.contract, props.tokenId]);

  return {
    data: activeClaimCondition,
    error,
    isLoading,
  };
}

