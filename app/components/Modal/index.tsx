import {
  Button,
  Modal as Mdl,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  useDisclosure,
} from '@chakra-ui/react';
import { ReactElement } from 'react';

type ModalProps = {
  title: string;
  triggerText: string;
  body: ReactElement;
};

function Modal(props: ModalProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  return (
    <>
      <Button onClick={onOpen}>{props.triggerText}</Button>

      <Mdl
        size={'md'}
        isOpen={isOpen}
        onClose={onClose}
        motionPreset="slideInBottom"
        isCentered
      >
        <ModalOverlay
          bg={'black'}
          backdropBlur={'2px'}
          backdropFilter={'auto'}
          backdropInvert={'80%'}
        />
        <ModalContent>
          <ModalHeader>{props.title}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>{props.body}</ModalBody>

          {/* <ModalFooter>
            <p>footer</p>
          </ModalFooter> */}
        </ModalContent>
      </Mdl>
    </>
  );
}

export default Modal;
