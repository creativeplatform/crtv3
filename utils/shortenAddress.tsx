export const truncateAddress = (address: string, length = 12) => {
    if (address.length <= length) {
      return address;
    }
  
    const halfLength = Math.floor((length - 3) / 2);
    const truncatedAddress =
      address.substring(0, halfLength) +
      '...' +
      address.substring(address.length - halfLength);
  
    return truncatedAddress;
  };