import { fetchAllAssets } from '@app/api/livepeer/actions';
import { Asset } from '@app/lib/types';
import { Box, Skeleton } from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';

type ListUploadedAssetsProps = {
  [index: string]: any;
  activeAccount: any;
};

export default function ListUploadedAssets(props: ListUploadedAssetsProps) {
  const [assets, setAssets] = useState<Asset[] | {}>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchAllAssets()
      .then((ast) => {
        setIsLoading(true);

        setAssets(ast as any);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [props]);

  const filteredAssets: Asset[] = useMemo(() => {
    return Array.isArray(assets)
      ? assets.filter(
          (ast: Asset) => ast.creatorId?.value === props.activeAccount.addresss,
        )
      : [];
  }, [assets, props.activeAccount.addresss]);

  if (isLoading) {
    return <Skeleton height={'20px'} />;
  }

  if (error) {
    return (
      <Box mb={24}>
        <p>Error loading assets</p>{' '}
      </Box>
    );
  }

  return <></>;
}
