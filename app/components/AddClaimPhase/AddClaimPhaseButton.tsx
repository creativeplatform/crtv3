import { AddIcon, CloseIcon } from '@chakra-ui/icons';
import { Button } from '@chakra-ui/react';

type AddClaimPhaseButtonProps = {
  addClaimPhase: boolean;
  setAddClaimPhase: (args: boolean) => void;
  children: string;
};

export default function AddClaimPhaseButton(props: AddClaimPhaseButtonProps) {
  return (
    <Button
      className="mt-24 text-base border border-slate-300"
      colorScheme={props.addClaimPhase ? 'red' : ''}
      leftIcon={
        !props.addClaimPhase ? (
          <AddIcon fontSize={10} />
        ) : (
          <CloseIcon fontSize={10} />
        )
      }
      onClick={() => props.setAddClaimPhase(!props.addClaimPhase)}
    >
      {props.children}
    </Button>
  );
}
