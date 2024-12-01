import { parseTimestampToDate } from '../index';

describe('parseTimestampToDate', () => {
  it('should return "Not available" for 0 timestamp', () => {
    const res = parseTimestampToDate(0);
    expect(res).toBe('Not available');
  });

  it('should return formatted date for a valid timestamp', () => {
    const ts = 1672531199000;
    const res = parseTimestampToDate(ts);

    expect(res).toBe('January 1, 2023');
  });

  it('should return "Not available" for negative timestamp', () => {
    const res = parseTimestampToDate(-100000000);
    expect(res).toBe('Not available');
  });
});
