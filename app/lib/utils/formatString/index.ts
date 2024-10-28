// Types
type DateTypes = 'long' | 'short' | 'full' | 'medium' | undefined;
type TimeTypes = 'long' | 'short' | 'full' | 'medium' | undefined;
type NotationTypes =
  | 'compact'
  | 'standard'
  | 'scientific'
  | 'engineering'
  | undefined;
type CurrencyConverterType = {
  amount: number | string;
  showSign?: boolean;
  removeZeros?: boolean;
};

const handleDecimals = (num: string, removeZeros: boolean = false) => {
  const hasDecimal = /\./;
  const hasSingleDecimal = /\.\d$/;
  const hasTooManyZeros = /\.0{6,}(\d)/;

  if (!hasDecimal.test(num)) {
    return num + '.00';
  }

  if (hasSingleDecimal.test(num)) {
    return num + '0';
  }

  if (hasTooManyZeros.test(num) && removeZeros) {
    return num.replace(hasTooManyZeros, '.0...$1');
  }

  return num;
};

export const fromTimestampToDate = (timestamp: number | bigint) => {
  const ts = typeof timestamp === 'bigint' ? Number(timestamp) : timestamp;

  return formatDate(ts * 1000, 'long', 'short');
};

const maxSignificantDigits = (num: number, count: number = 0): number => {
  if (num > 0) {
    return maxSignificantDigits(Math.floor(num / 10), ++count);
  }

  return count;
};

export const uppercaseFirst = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const formatDate = (
  date: number | Date | undefined,
  dateType: DateTypes = 'long',
  timeType?: TimeTypes,
) =>
  Intl.DateTimeFormat('en', {
    dateStyle: dateType,
    timeStyle: !!timeType ? timeType : undefined,
  }).format(date);

export const formatTime = (
  date: number | Date | undefined,
  timeType: TimeTypes = 'short',
): string =>
  Intl.DateTimeFormat('en-EN', {
    timeStyle: timeType,
  }).format(date);

export const formatNumber = (
  number: number | string,
  notation: NotationTypes = 'compact',
  removeZeros: boolean = false,
) => {
  const numeric = typeof number === 'string' ? parseFloat(number) : number;
  const numUnits = maxSignificantDigits(numeric);
  const minSignificant = numUnits === 1 ? 3 : 2;
  const maxSignifican = numUnits >= 1 ? numUnits + 2 : 2;

  const formatted = new Intl.NumberFormat('en-EN', {
    style: 'decimal',
    notation,
    minimumSignificantDigits: notation === 'standard' ? minSignificant : 2,
    maximumSignificantDigits: notation === 'standard' ? maxSignifican : 2,
  }).format(numeric);

  return notation === 'standard'
    ? handleDecimals(formatted, removeZeros)
    : formatted;
};

export const currencyConverter = ({
  amount,
  showSign = false,
  removeZeros = false,
}: CurrencyConverterType) => {
  const numeric = typeof amount === 'string' ? parseFloat(amount) : amount;
  const numUnits = maxSignificantDigits(numeric);
  const minSignificant = numUnits === 1 ? 3 : 2;
  const maxSignifican = numUnits >= 1 ? numUnits + 2 : 2;

  const formatted = new Intl.NumberFormat('en-EN', {
    style: 'currency',
    currency: 'USD',
    signDisplay: showSign ? 'always' : 'never',
    minimumSignificantDigits: minSignificant,
    maximumSignificantDigits: maxSignifican,
  }).format(numeric);

  return handleDecimals(formatted, removeZeros);
};

export const removeUnderScore = (str: string) => {
  if (!str.includes('_')) {
    return str.toUpperCase();
  } else {
    return str.split('_').join(' ').toUpperCase();
  }
};
