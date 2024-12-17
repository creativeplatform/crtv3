import { NFT } from '@app/types/nft';
import {
  HStack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  VStack,
} from '@chakra-ui/react';
import { useState } from 'react';

type ConfigureMintedAssetProps = {
  nft: NFT;
  toggleModal: () => void;
};

export default function ConfigureMintedAsset(props: ConfigureMintedAssetProps) {
  console.log('ConfigureMintedAsset::props ', props.nft.id);
  const [tabIndex, setTabIndex] = useState(0);
  const tabList = ['Details', 'Claim Conditions', 'Claim'];

  const handleTabsChange = (idx: number) => {
    setTabIndex(idx);
  };

  return (
    <div className="fixed inset-0 h-screen overflow-y-auto bg-black bg-opacity-50 ">
      <div className="relative top-96 mx-auto w-full max-w-md rounded-lg bg-white p-8 shadow dark:bg-slate-800">
        <button
          onClick={props.toggleModal}
          className="absolute right-4 top-2 text-gray-600 hover:text-gray-800 focus:outline-none dark:hover:text-gray-200"
        >
          <p className="text-lg font-semibold">&times;</p>
        </button>

        <Tabs index={tabIndex} onChange={handleTabsChange}>
          <TabList style={{ gap: 48, marginBottom: 24 }}>
            {tabList.length > 0 &&
              tabList.map((label, i) => (
                <Tab key={i} fontWeight={500} name={label}>
                  {label}
                </Tab>
              ))}
          </TabList>

          <TabPanels>
            <TabPanel>
              <HStack spacing={12} my={4}>
                <VStack
                  spacing={4}
                  alignItems={'flex-start'}
                  style={{ fontWeight: 400 }}
                  className="text-slate-400"
                >
                  <span>Token Type: </span>
                  <span>Token ID: </span>
                  <span>Suppy:</span>
                </VStack>
                <VStack
                  spacing={2}
                  alignItems={'flex-start'}
                  style={{ fontWeight: 400 }}
                  color={'gray.300'}
                >
                  <p>{props.nft.type}</p>
                  <p>{props.nft.id.toString()}</p>
                  <p>{props.nft.supply.toString()}</p>
                </VStack>
              </HStack>
            </TabPanel>
            <TabPanel>
              <VStack spacing={0} alignItems={'flex-start'} my={4}>
                {/* ListClaimConditions */}
              </VStack>
            </TabPanel>

            <TabPanel>{/*  ClaimNFTForCreator */}</TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>
  );
}
