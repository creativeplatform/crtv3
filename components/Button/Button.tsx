import React from 'react';
import { Button as ChackraUIButton, ButtonProps } from '@chakra-ui/react';

const Button: React.FC<ButtonProps> = (p) => {
  return (
    <ChackraUIButton
      {...p}
      height="40px"
      borderRadius="14px"
      bg="general.button !important"
      fontSize="14px"
      color="#EC407A"
      _active={{ transform: 'scale(0.95)' }}
    >
      {p.children}
    </ChackraUIButton>
  );
};

export default Button;