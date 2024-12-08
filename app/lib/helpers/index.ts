/**
 * Function to parse timestamp to readable date
 * @param dateString The date object to parse
 * @returns Form input date
 *
 * @example
 * const date = parseDate('Tue Jan 16 2024 13:13:32')
 *  =>  16/01/2024 13:13
 */
function parseTimestampToDate(ts: number) {
  if (ts <= 0) {
    return 'Not available';
  }

  const d = new Date(ts);
  const longEnUSFormat = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return longEnUSFormat.format(d);
}

/**
 * The function wrap a sentence at particular length of characters
 * @param txt The sentence body
 * @param wrapAfter The number of characters to start
 * @returns The wrapped sentence
 */
const wordWrap = (txt: string, wrapAfter: number) => {
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

const titleCase = (txt: string) => {
  if (typeof txt != 'string') {
    throw new Error(`The argument ${txt} is not a string`);
  }
  if (txt === '') throw new Error('Can not parse empty string');
  
  return txt.slice(0, 1).toUpperCase() + txt.slice(1);
};

export { parseTimestampToDate, titleCase, wordWrap };
