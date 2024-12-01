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
  if (!ts) {
    return 'Not available';
  } else {
    const d = new Date(ts);
    const longEnUSFormat = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return longEnUSFormat.format(d);
  }
}

export { parseTimestampToDate };
