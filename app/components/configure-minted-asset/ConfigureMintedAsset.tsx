import { videoContract } from '@app/lib/sdk/thirdweb/get-contract';
import { NFT, ResolvedReturnType } from '@app/types/nft';
import {
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  VStack,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { getClaimConditions } from 'thirdweb/extensions/erc1155';
import { useReadContract } from 'thirdweb/react';
import ListClaimConditions from '../ListClaimConditions/ListClaimConditions';
import SetClaimConditions from '../SetClaimConditions/SetClaimConditions';
import ClaimVideoNFT from '../claim-vidoe-nft/ClaimVideoNFT';

type ConfigureMintedAssetProps = {
  nft: NFT;
  toggleModal: () => void;
  setAddClaimPhase: (arg: boolean) => void;
  addClaimPhase: boolean;
};

export default function ConfigureMintedAsset(props: ConfigureMintedAssetProps) {
  const tabList = ['Details', 'Claim Conditions', 'Claim'];
  const [tabIndex, setTabIndex] = useState(0);
  const [activeTab, setActiveTab] = useState(tabList[0]);

  const [claimConditions, setClaimConditions] = useState<
    ResolvedReturnType<ReturnType<typeof getClaimConditions>>
  >([]);

  const [processingClaimConditions, setProcessingClaimConditions] =
    useState(false);

  const { data: activeClaimCondition, error: activeClaimError } =
    useReadContract({
      contract: videoContract,
      method:
        'function getActiveClaimConditionId(uint256 _tokenId) view returns (uint256)',
      params: [props.nft.id /*1n*/], // TODO: take watch of this props.nft.id
    });

  console.log({ activeClaimCondition });

  const handleTabsChange = (idx: number) => {
    setTabIndex(idx);
  };

  useEffect(() => {
    const getClaimConditionsById = async (tokenId: bigint) => {
      console.log('getClaimConditionsById: ', tokenId);

      try {
        setProcessingClaimConditions(true);
        // fetch all existing claim conditions
        const cc = await getClaimConditions({
          contract: videoContract,
          tokenId,
        });

        if (cc && cc?.length > 0) {
          setProcessingClaimConditions(false);

          setClaimConditions([...cc]);
        }
      } catch (err: any) {
        setProcessingClaimConditions(false);
        console.error(err);
      }
    };

    getClaimConditionsById(props.nft.id);
  }, [props.nft.id]);

  return (
    <div className="fixed inset-0 h-screen overflow-y-auto bg-black bg-opacity-90">
      <div className="relative top-44 mx-auto w-full max-w-2xl rounded-lg bg-white p-8 shadow dark:bg-slate-800">
        <button
          onClick={props.toggleModal}
          className="absolute right-4 top-2 text-gray-600 hover:text-gray-800 focus:outline-none dark:hover:text-gray-200"
        >
          <p className="text-lg font-semibold">&times;</p>
        </button>

        <Tabs index={tabIndex} onChange={handleTabsChange}>
          <TabList className="mb-8 gap-16">
            {tabList.length > 0 &&
              tabList.map((label, i) => (
                <Tab
                  key={i}
                  fontWeight={300}
                  name={label}
                  className="text-slate-400"
                  style={{
                    padding: '2px 6px',
                    backgroundColor:
                      label === activeTab
                        ? '#666'
                        : label === tabList[tabList.length - 1] &&
                            activeClaimCondition === undefined
                          ? '#1e1e1e'
                          : '',
                  }}
                  _hover={{
                    cursor:
                      label === tabList[tabList.length - 1] &&
                      activeClaimCondition === undefined
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                  onClick={() => {
                    if (label != tabList[tabList.length - 1]) {
                      setActiveTab(label);
                    }
                    return;
                  }}
                >
                  {label}
                </Tab>
              ))}
          </TabList>

          <TabPanels>
            <TabPanel>
              <div className="my-8 flex flex-col gap-2 font-medium text-slate-400">
                <p className="flex">
                  <span className="min-w-28"> Token Type: </span>
                  <span className="text-slate-300">{props.nft.type}</span>
                </p>

                <p className="flex">
                  <span className="min-w-28">Token ID:</span>
                  <span className="text-slate-300">
                    {props.nft.id.toString()}
                  </span>
                </p>

                <p className="flex">
                  <span className="min-w-28">Suppy:</span>
                  <span className="text-slate-300">
                    {props.nft.supply.toString()}
                  </span>
                </p>
              </div>
            </TabPanel>
            <TabPanel>
              <VStack spacing={0} alignItems={'flex-start'} my={4}>
                <ListClaimConditions
                  processingClaimConditions={processingClaimConditions}
                  nftContract={videoContract}
                  nft={props.nft!}
                  claimConditions={claimConditions}
                  addClaimPhase={props.addClaimPhase}
                  setAddClaimPhase={props.setAddClaimPhase}
                />
              </VStack>

              {props.addClaimPhase && (
                <SetClaimConditions
                  numberOfClaimsConditonsAvailable={claimConditions.length}
                  nft={props.nft}
                  setAddClaimPhase={props.setAddClaimPhase}
                  claimConditions={claimConditions}
                />
              )}
            </TabPanel>

            <TabPanel>
              <ClaimVideoNFT videoContract={undefined} />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>
  );
}
