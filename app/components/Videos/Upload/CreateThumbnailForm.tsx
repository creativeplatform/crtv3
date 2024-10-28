import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
} from '../../ui/select'; // Adjust the import path as needed
import { Button } from '../../ui/button'; // Adjust the import path as needed
import { SparklesIcon } from 'lucide-react';
import Image from 'next/image';
import { Textarea } from '@app/components/ui/textarea';
import { Label } from '@app/components/ui/label';
import { getLivePeerAiGeneratedImages } from '@app/api/livepeer/livepeerAiActions';
import { Media } from 'livepeer/models/components';
import { RadioGroup, RadioGroupItem } from '@app/components/ui/radio-group';
import { Skeleton } from '@app/components/ui/skeleton';

interface FormValues {
  aiModel: string;
  prompt: string;
}

type CreateThumbnailFormProps = {
  onSelectThumbnailImages: (imageUrl: string) => void;
};

const CreateThumbnailForm = ({
  onSelectThumbnailImages,
}: CreateThumbnailFormProps) => {
  const {
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({
    defaultValues: {
      aiModel: 'SG161222/RealVisXL_V4.0_Lightning', // Set default value if needed
      prompt: '',
    },
  });

  const [imagesUrl, setImagesUrl] = useState<Media[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | undefined>(
    undefined,
  ); // Added state
  const [loading, setLoading] = useState<boolean>(false); // New loading state

  const onSubmit = async (data: FormValues) => {
    setLoading(true); // Set loading state to true
    try {
      const response = await getLivePeerAiGeneratedImages({
        prompt: data.prompt,
        modelId: data.aiModel,
      });
      if (response.success) {
        setImagesUrl((currentImages) => [
          ...currentImages,
          ...response.result.images,
        ]);
      } else {
        throw new Error(response.result);
      }
    } catch (e) {
      console.log('Error', e);
      setError('root', {
        message: 'Error generating AI images',
      });
    } finally {
      setLoading(false); // Reset loading state
    }
  };

  useEffect(() => {
    console.log('Updated imagesUrl state:', imagesUrl);
  }, [imagesUrl]);

  const handleSelectionChange = (value: string) => {
    setSelectedImage(value);
    onSelectThumbnailImages(value);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Controller
        name="aiModel"
        control={control}
        rules={{ required: 'AI Model is required' }}
        render={({ field }) => (
          <Select onValueChange={field.onChange} value={field.value}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select A Model" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Models</SelectLabel>
                <SelectItem value="SG161222/RealVisXL_V4.0_Lightning">
                  Lightning
                </SelectItem>
                <SelectItem value="black-forest-labs/FLUX.1-schnell">
                  Black Forest
                </SelectItem>
                <SelectItem value="alimama-creative/FLUX.1-Turbo-Alpha">
                  Alima
                </SelectItem>
                <SelectItem value="CompVis/stable-diffusion-v1-4">
                  CompVis
                </SelectItem>
                <SelectItem value="stabilityai/stable-diffusion-2">
                  Stability
                </SelectItem>
                <SelectItem value="Shakker-Labs/FLUX.1-dev-LoRA-One-Click-Creative-Template">
                  Shakker
                </SelectItem>
                <SelectItem value="aleksa-codes/flux-ghibsky-illustration">
                  Ghibsky
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
      />
      {errors.aiModel && (
        <p className="text-red-500">{errors.aiModel.message}</p>
      )}

      {/* Add a prompt input field */}
      <Controller
        name="prompt"
        control={control}
        rules={{ required: 'Prompt is required' }}
        render={({ field }) => (
          <Textarea
            {...field}
            placeholder="Enter your prompt"
            className="w-full rounded border p-2"
            rows={4}
          />
        )}
      />
      {errors.prompt && <p className="text-red-500">{errors.prompt.message}</p>}

      <Button type="submit" disabled={isSubmitting}>
        <SparklesIcon className="mr-1 h-4 w-4" />
        {isSubmitting ? 'Generating...' : 'Generate'}
      </Button>

      {errors['root'] && (
        <p className="text-red-500">{errors['root'].message}</p>
      )}

      {/* Render Skeletons while loading */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton
              key={idx}
              width="100%"
              height="200px"
              className="rounded-md"
            />
          ))}
        </div>
      ) : (
        <RadioGroup
          onValueChange={handleSelectionChange}
          value={selectedImage}
          className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
        >
          {imagesUrl.length === 0 && (
            <p className="col-span-full text-center text-gray-500">
              No images generated yet.
            </p>
          )}
          {imagesUrl.map((img, idx) => (
            <div key={idx} className="flex flex-col items-center">
              <RadioGroupItem
                value={img.url}
                id={`thumbnail_checkbox_${idx}`}
                className="mb-2"
              />
              <Label htmlFor={`thumbnail_checkbox_${idx}`}>
                <Image
                  src={img.url}
                  alt={`Thumbnail ${idx + 1}`}
                  width={200}
                  height={200}
                  className="rounded-md border object-cover"
                />
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}
    </form>
  );
};

export default CreateThumbnailForm;
