import useLazyMint from '@app/hooks/useLazyMint';
import { useState } from 'react';

type LazyMintProps = {
  baseURIForToken: string;
  toggleModal: () => void;
};

export default function LazyMintModal(props: LazyMintProps) {
  const {
    handleLazyMint,
    isProcessing,
    error: lazyMintError,
    txnHash,
  } = useLazyMint();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const selectTagOptions = [{ value: 'DAI', label: 'DAI' }];

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const target = e.target;
    const value = target.value;
    const name = target.name;

    setFormData((prev) => {
      return { ...prev, [name]: value };
    });
  };

  const handleLazyMinting = (e: React.FormEvent) => {
    e.preventDefault();

    handleLazyMint(formData.amount, formData.price, props.baseURIForToken);
  };

  return (
    <>
      <div className="fixed inset-0 h-screen overflow-y-auto bg-black bg-opacity-50 ">
        <div className="relative top-96 mx-auto w-full max-w-md rounded-lg bg-white p-8 shadow dark:bg-slate-800">
          <button
            onClick={props.toggleModal}
            className="absolute right-4 top-2 text-gray-600 hover:text-gray-800 focus:outline-none dark:hover:text-gray-200"
          >
            <p className="text-lg font-semibold">&times;</p>
          </button>

          <h2 className="mb-8 text-xl font-bold">Enter Amount and Price</h2>

          <form className="space-y-4">
            <div className="flex flex-col space-y-1">
              <label
                htmlFor="amount"
                className="font-light dark:text-slate-400"
              >
                Amount:
              </label>
              <input
                type="number"
                id="amount"
                name="amount"
                onChange={handleChange}
                className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isProcessing}
              />
            </div>

            <div className="flex flex-col space-y-1">
              <label htmlFor="price" className="font-light dark:text-slate-400">
                Price:
              </label>
              <input
                type="number"
                id="price"
                name="price"
                onChange={handleChange}
                className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isProcessing}
              />
            </div>
            <div className="flex flex-col space-y-1">
              <label htmlFor="price" className="font-light dark:text-slate-400">
                Currency:
              </label>
              <select
                id="currency"
                name="currency"
                onChange={handleChange}
                className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-400"
                disabled={isProcessing}
              >
                <option value="Select a Currency">
                  --- select a currency ---
                </option>
                {selectTagOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </form>

          <div className="mt-6 space-x-2 text-right">
            <button
              className={`min-w-10 rounded bg-[--brand-red] px-4 py-2 text-white transition duration-300 hover:bg-[--brand-red-shade]
                ${isProcessing && `hover: cursor-progress`}
              `}
              onClick={handleLazyMinting}
              disabled={isProcessing}
            >
              {isProcessing ? 'Minting...' : ' Lazy Mint'}
            </button>
            <button
              onClick={props.toggleModal}
              className="min-w-10 rounded bg-gray-600 px-4 py-2 text-white transition duration-300 hover:bg-gray-500"
            >
              Cancel
            </button>
          </div>

          <div className="space-x-2 text-sm mt-6">
            {lazyMintError && (
              <p className="text-rose-500">{lazyMintError.message}</p>
            )}
            {txnHash && <p className="text-white">Txn Hash: {txnHash}</p>}
          </div>
        </div>
      </div>
    </>
  );
}
