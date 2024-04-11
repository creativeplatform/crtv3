"use client";
import { Flex, HStack } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import Member from '../Member/Member';
import * as S from './Content.styled';
import NonLoggedInView from './NonLoggedInView/NonLoggedInView';

const Content = () => {
  const activeAccount = useActiveAccount();
  const [showChild, setShowChild] = useState(false);
  useEffect(() => {
    setShowChild(true);
  }, []);

  if (!showChild) {
    return null;
  }

  return (
    <Flex
      direction={['column', 'column', 'column', 'row']}
      className="pt-24 pb-3 mx-auto"
      justifyContent="center"
      alignItems="center"
      maxW="1500px"
    >
      <S.WebGraphic
        src="/web_graphic.gif"
        width={450}
        height={550}
        alt="Creative mascot"
      />
      {activeAccount ? <Member /> : <NonLoggedInView />}
    </Flex>
  );
};

export default Content;