import type { NextPage } from 'next';
import WertWidget from '@wert-io/widget-initializer';
import type { Options } from '@wert-io/widget-initializer/types';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@chakra-ui/react';
import { TbMoneybag } from 'react-icons/tb'
import { useActiveAccount } from 'thirdweb/react';

const AddFunds: NextPage = () => {
    const activeAccount = useActiveAccount()

    if (activeAccount) {
    // WERT OPTIONS
    const options: Options = {
        partner_id: "01FGKYK638SV618KZHAVEY7P79",
        origin: "https://sandbox.wert.io",
        commodity: 'MATIC',
        address: activeAccount?.address,
        network: 'sepolia',
        lang: 'en',
        click_id: uuidv4(),
        color_buttons: "#EC407A",
        commodities: JSON.stringify([
            {
              commodity: "MATIC",
              network: "mumbai",
            },
          ]),
        currency_amount: 10,
        listeners: {
        loaded: () => console.log('loaded'),
        },
    }

    const wertWidget = new WertWidget(options)

    return (
        <>
            <Button leftIcon={<TbMoneybag />} variant='solid' onClick={() => wertWidget.open()}>Add Funds</Button>
        </>
    )
}
    return (
        <>
            <Button leftIcon={<TbMoneybag />} variant='solid' onClick={() => alert('You must be connected to purchase crypto')}>Add Funds</Button>
        </>
    )
}

export default AddFunds;