import { Image } from '@chakra-ui/react'

export const PosterImage = (props: { imgSrc: string; alt: string }) => {
  return <Image src={props.imgSrc} objectFit="contain" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" alt={props.alt} />
}