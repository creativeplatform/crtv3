import React from 'react';
import { Input as ChackraUIInput, InputProps } from '@chakra-ui/react';

const Input: React.FC<InputProps> = (p) => {
  return (
    <ChackraUIInput
      {...p}
      bg={'#1A202C'}
      borderRadius="14px"
      border="1px solid #FFF"
      color="#EC407A"
      height="44px"
      fontSize="16px"
      _hover={{ bg: '#1A202C', borderColor: '#EE774D' }}
      _focus={{ bg: '#1A202C', borderColor: '#EE774D' }}
      _disabled={{ bg: '#1A202C', borderColor: '#EE774D' }}
      _placeholder={{ color: '#FACB80' }}
      fontWeight={'400'}
    />
  );
};

export default Input;