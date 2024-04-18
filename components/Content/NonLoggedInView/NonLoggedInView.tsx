import React from'react';
import { chakra, Box } from '@chakra-ui/react';
import HeroSection from '../../home-page/HeroSection';
import FeaturedVideo from '../../home-page/Featured';

const NonLoggedInView = () => {

  return (
  <>
    <HeroSection />
    <FeaturedVideo />
  </>
  );
};

export default NonLoggedInView;