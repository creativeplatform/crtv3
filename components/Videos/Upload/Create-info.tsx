"use client";

import { useForm, Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { Button } from "@/components/ui/button";
import { FormControl, FormLabel } from "@/components/ui/form";
import { FormEvent, useEffect } from "react";
import { Form } from "@/components/ui/form";
import { VIDEO_GENRES } from "@/lib/constants/video-genres";

type TCreateInfoProps = {
  onPressNext: (formData: TVideoMetaForm) => void;
};

import type { CollaboratorFormData } from "@/lib/types/splits";

export type TVideoMetaForm = {
  title: string;
  description: string;
  location?: string;
  category?: string;
  ticker: string;
  collaborators?: CollaboratorFormData[];  // Optional array of collaborators for revenue splits
};

const CreateInfo = ({ onPressNext }: TCreateInfoProps) => {
  const form = useForm<TVideoMetaForm>({
    mode: "onChange",
    defaultValues: {
      title: "",
      description: "",
      location: "",
      category: "",
      ticker: ""
    },
  });

  const onSubmit = (data: TVideoMetaForm) => {
    onPressNext(data);
  };

  const handleSelectCategory = (value: string) =>
    form.setValue("category", value);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="my-4 flex justify-center sm:my-6">
          <h4 className="stepper_step_heading text-lg sm:text-xl">Details</h4>
        </div>
        <div className="my-3 sm:my-4">
          <Label htmlFor="title" className="text-sm">
            Title
          </Label>
          <Input
            id="title"
            placeholder="Rick Astley - Never Gonna Give You Up (Official Video)"
            className={
              "mt-2 h-10 w-full rounded-md border border-[#444752] p-2 text-sm " +
              "text-gray-600 dark:text-gray-200 dark:bg-[#1a1a1a] " +
              "placeholder:text-gray-400 dark:placeholder:text-gray-500 " +
              "focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-600 " +
              "sm:h-12 sm:text-base"
            }
            data-testid="create-info-title"
            {...form.register("title", {
              required: true,
            })}
          />
        </div>
        <div className="mt-6 sm:mt-10">
          <Label className="text-sm">Description</Label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-2">
            Markdown is supported (e.g., **bold**, *italic*, [links](url), lists, etc.)
          </p>
          <textarea
            placeholder="Never Gonna Give You Up was a global smash on its release in July 1987, topping the charts in 25 countries 
            including Rick's native UK and the US Billboard Hot 100. It won the Brit Award for Best single in 1988. 
            Stock Aitken and Waterman wrote and produced the track which was the lead-off single from Rick's debut LP "
            className={
              "mt-2 h-24 w-full rounded-md border border-[#444752] p-2 text-sm " +
              "text-gray-600 dark:text-gray-200 dark:bg-[#1a1a1a] " +
              "placeholder:text-gray-400 dark:placeholder:text-gray-500 " +
              "focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-600 " +
              "sm:h-32 sm:text-base"
            }
            data-testid="create-info-description"
            {...form.register("description", {
              required: true,
            })}
          />
        </div>
        <div className="mt-6 flex w-full flex-col gap-4 sm:mt-10 sm:flex-row sm:justify-between lg:gap-6">
          <div className="flex w-full flex-col sm:w-2/5">
            <Label className="text-sm">Location</Label>
            <Input
              type="text"
              placeholder="New York - United States"
              className={
                "mt-2 h-10 w-full rounded-md border border-[#444752] p-2 text-sm " +
                "text-gray-600 dark:text-gray-200 dark:bg-[#1a1a1a] " +
                "placeholder:text-gray-400 dark:placeholder:text-gray-500 " +
                "focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-600 " +
                "sm:h-12 sm:text-base"
              }
              data-testid="create-info-location"
              {...form.register("location", {
                required: false,
              })}
            />
          </div>
          <div className="flex w-full flex-col sm:w-2/5">
            <Label className="text-sm">Content Coin Ticker</Label>
            <Input
              type="text"
              placeholder="VID1"
              maxLength={10}
              className={
                "mt-2 h-10 w-full rounded-md border border-[#444752] p-2 text-sm " +
                "text-gray-600 dark:text-gray-200 dark:bg-[#1a1a1a] " +
                "placeholder:text-gray-400 dark:placeholder:text-gray-500 " +
                "focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-600 " +
                "sm:h-12 sm:text-base"
              }
              {...form.register("ticker", {
                required: true,
                pattern: {
                  value: /^[A-Z0-9]+$/,
                  message: "Ticker must be uppercase alphanumeric"
                }
              })}
            />
            {form.formState.errors.ticker && <span className="text-xs text-red-500">{form.formState.errors.ticker.message}</span>}
          </div>

          <div className="flex w-full flex-col sm:w-2/5">
            <FormLabel className="text-sm">Genre</FormLabel>
            <Controller
              name="category"
              control={form.control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="create-info-category" className="mt-2 h-10 text-sm sm:h-12 sm:text-base">
                      <SelectValue placeholder="Select a Genre" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {VIDEO_GENRES.map((genre) => (
                      <SelectItem key={genre.value} value={genre.value}>
                        {genre.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-center sm:mt-6">
          <Button
            type="submit"
            className="w-full min-w-[120px] text-sm sm:w-auto sm:text-base touch-manipulation"
            disabled={!form.formState.isValid}
            data-testid="create-info-next"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            Next
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default CreateInfo;
