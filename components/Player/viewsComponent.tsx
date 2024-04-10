import React from 'react'
import { Box, StatGroup, Stat, StatLabel, StatNumber } from '@chakra-ui/react'

function ViewsComponent (props: any) {
  return (
    <Box>
      <StatGroup key={props.id}>
        <Stat>
          <StatLabel>Views</StatLabel>
          <StatNumber>{props.startViews}</StatNumber>
        </Stat>
      </StatGroup>
    </Box>
  )
}

export default ViewsComponent;