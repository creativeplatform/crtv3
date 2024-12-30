import { useState } from 'react';
import { ContractOptions } from 'thirdweb';
import { useActiveAccount } from 'thirdweb/react';
import { NFT, ResolvedReturnType } from '@app/types/nft';

type ClaimVideoNFTProps = {
  videoContract: Readonly<ContractOptions<[]>> | undefined;
};

export default function ClaimVideoNFT(props: ClaimVideoNFTProps) {
  const activeAccount = useActiveAccount();
  const [qty, setQTY] = useState(1);

  const handleSubmit = async () => {

    console.log({ qty });


    return;
    // const transaction = claimTo({
    //   contract: props.videoContract,
    //   to: String(activeAccount?.address),
    //   tokenId: 0n,
    //   quantity: BigInt(qty),
    // });

    // await sendTransaction({ transaction, account: activeAccount!! });
  };

  const handleOnChange = (e: React.FormEvent<HTMLInputElement>) => {
    e.preventDefault();

    setQTY(Number(e.currentTarget.value));
  };

  return (
    <div>
      <h4 className="mb-1 text-lg text-slate-300">ClaimNFT For Creator</h4>
      <p className="mb-2 text-sm text-slate-400">
        This hold the claim component for the creator
      </p>

      <form className="flex flex-col gap-4">
        <input type="number" name="quantity" onChange={handleOnChange} min={qty}  />
        <input type="submit" name="submit" onClick={handleSubmit} />
      </form>
    </div>
  );
}
