import { NFT } from '@app/types/nft';
import {
  getCurrencyMetadata,
  GetCurrencyMetadataResult,
} from 'thirdweb/extensions/erc20';
import { NFTMetadata } from 'thirdweb/utils';
import { erc20Contract } from '../sdk/thirdweb/get-contract';
import { CONTRACT_ADDRESS } from '../utils/context';

/**
 * Function to parse `Date` string
 * @param dateString The date object to parse
 * @returns Form input date
 *
 * @example
 * const date = parseDate('Tue Jan 16 2024 13:13:32')
 *  =>  // '2024-01-16T13:13'
 */
export function parseDate(timestamp: bigint) {
  const d = new Date(Number(timestamp));

  const hour = d.getHours();
  const minutes = d.getMinutes();
  const date = d.getDate();
  const month = d.getMonth();
  const year = d.getFullYear();

  const dd = date > 10 ? date : `0${date}`;
  const mm = month > 10 ? month : `0${month + 1}`;
  const hh = hour > 10 ? hour : `0${hour}`;
  const min = minutes > 10 ? minutes : `0${minutes}`;

  // '2024-01-16T11:45'
  return `${year}-${mm}-${dd}T${hh}:${min}`;
}

/**
 * Function to parse timestamp to readable date
 * @param dateString The date object to parse
 * @returns Form input date
 *
 * @example
 * const date = parseTimestampToDate(1982736542)
 *  =>  16/01/2024 13:13
 */
export function parseTimestampToDate(ts: number) {
  if (ts <= 0) {
    return 'Not available';
  }

  const d = new Date(ts * 1000);
  const longEnUSFormat = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return longEnUSFormat.format(d);
}

/**
 * Function to parse timestamp to readable date
 * @param ts The timestamp is bigint format
 * @returns Locale Date
 *
 * @example
 * const date = timestampToDateString(1734801000)
 *  =>  12/22/2024, 09:59 AM
 */
export function timestampToDateString(ts: bigint) {
  const { day, hours, minutes, month, seconds, year } = dateObject(ts);

  return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
}

export function timestampToInputDateString(ts: bigint) {
  const { day, hours, minutes, month, seconds, year } = dateObject(ts);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

type DateObjectType = {
  day: string;
  month: string;
  year: number;
  hours: string;
  minutes: string;
  seconds: string;
};
/**
 * Function to return the elements of a Date object
 * @param ts timestamp to be converted
 * @returns date object
 */
function dateObject(ts: bigint): DateObjectType {
  const tsNumber = Number(ts);
  if (tsNumber <= 0) {
    return {
      day: '00',
      month: '00',
      year: 0,
      hours: '00',
      minutes: '00',
      seconds: '00',
    };
  }

  const date = new Date(tsNumber * 1000);

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return { day, month, year, hours, minutes, seconds };
}

/**
 * The function wrap a sentence at particular length of characters
 * @param txt The sentence body
 * @param wrapAfter The number of characters to start
 * @returns The wrapped sentence
 */
export const wordWrap = (txt: string, wrapAfter: number) => {
  txt = txt.trim();

  if (txt.length < wrapAfter) {
    throw new Error(
      `String lenght of ${txt.length} is shorter than wrapAfter of ${wrapAfter}`,
    );
  }

  if (txt.length > wrapAfter) {
    return txt.slice(0, wrapAfter) + '...';
  }

  return txt;
};

export const titleCase = (txt: string) => {
  if (typeof txt != 'string') {
    throw new Error(`The argument ${txt} is not a string`);
  }
  if (txt === '') throw new Error('Can not parse empty string');

  return txt.slice(0, 1).toUpperCase() + txt.slice(1);
};

export const claimConditionsOptions = {
  phase: {
    'Select phase': '',
    'Phase 1': 'Phase 1',
  },
  waitInSecondsOptions: {
    'Select period': '',
    '5 mins': 60 * 5,
    '15 mins': 60 * 15,
    '30 mins': 60 * 30,
    '1 hr': 60 * 60 * 1,
    '3 hrs': 60 * 60 * 3,
    '6 hrs': 60 * 60 * 6,
    '9 hrs': 60 * 60 * 9,
    '12 hrs': 60 * 60 * 12,
    '24 hrs': 60 * 60 * 24,
    '48 hrs': 60 * 60 * 24 * 2,
    '72 hrs': 60 * 60 * 24 * 3,
    '96 hrs': 60 * 60 * 24 * 4,
    '120 hrs': 60 * 60 * 24 * 5,
  },
  currency: {
    // The tokens accepted for payment by the buyer
    USDC: CONTRACT_ADDRESS.erc20.USDC.chain.polygon.amoy,
    TESTR: CONTRACT_ADDRESS.erc20.TESTR.chain.polygon.mumbai,
  },
};

function extractCID(ipfsUri: string) {
  return ipfsUri.split(/\/\//g)[1];
}

export async function parseMetadata2(arr: NFT[]) {
  const ast: NFT[] = [];
  const delimiter = 'ipfs/';

  for (let i = 0; i < arr.length; i++) {
    let cid = arr[i].metadata.uri.split(delimiter)[1].substring(0, 59);

    if (cid != undefined) {
      const res = await fetch(
        `https://ipfs.livepeer.studio/${delimiter}${cid}`,
      );

      const mtd: NFTMetadata = await res.json();

      if (mtd.animation_url != undefined || mtd.animation_url !== '') {
        mtd.animation_url = `https://ipfs.livepeer.studio/${delimiter}${extractCID(mtd.animation_url!!)}`;
      }

      if (mtd.image != undefined || mtd.image !== '') {
        mtd.image = `https://ipfs.livepeer.studio/${delimiter}${extractCID(mtd.image!!)}`;
      }

      // arr[i].metadata = {
      //   ...mtd,
      // };
    }

    ast.push(arr[i]);
  }

  return ast;
}

export function fetchMetadata(uri: string) {
  console.log({ uri });

  const delimiter = '/';
  let mtd: Partial<NFTMetadata> = {};

  let cid = uri.split(delimiter)[2];
  console.log({ cid });

  // if (cid != undefined) {
  //   fetch(`https://ipfs.livepeer.studio/ipfs/${cid}`)
  //     .then((res) => res)
  //     .then(async (data) => {
  //       const d = await data.json();
  //       console.log(d);
  //     })
  //     .catch((err) => {
  //       console.error(err);
  //     });
  // }

  return 'ast';
}

export function parseIpfsUri(
  uri: string,
  baseURIGateway = 'https://ipfs.livepeer.studio/',
) {
  const delimiter = 'ipfs://';
  const cid = uri.split(delimiter)[1];
  const itemUri = baseURIGateway + 'ipfs/' + cid;

  return itemUri;
}

/**
 * Function to fetch ERC20 token metadata
 * @param address contract address of the ERC20 token
 * @returns Promise<GetCurrencyMetadataResult>
 */
export function getERC20Metadata(
  address: string,
): Promise<GetCurrencyMetadataResult> {
  return new Promise((resolve, reject) => {
    let currencyMetadata: GetCurrencyMetadataResult | null = null;

    const contract = erc20Contract(address);

    getCurrencyMetadata({
      contract,
    })
      .then((data: GetCurrencyMetadataResult) => {
        currencyMetadata = data;
        resolve(currencyMetadata);
      })
      .catch((err) => {
        console.error(err);
        reject(new Error('Error fetching currency metadata', err.message));
      });
  });
}

/**
 * Function to parse currency decimals
 * @param price The price of the nft
 * @param decimals The decimal point of the currency
 * @returns price in decimal format
 */
export const parseCurrencyDecimals = (price: bigint, decimals: number) => {
  if (decimals) {
    return parseInt(price.toString()) / 10 ** decimals;
  }
};
