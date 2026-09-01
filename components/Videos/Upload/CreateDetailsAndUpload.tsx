"use client";

import { useForm, Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../ui/select";
import { Button } from "@/components/ui/button";
import { FormControl, FormLabel, FormItem, FormField } from "@/components/ui/form";
import { Form } from "@/components/ui/form";
import FileUpload from "./FileUpload";
import { TVideoMetaForm } from "./Create-info";
import { useState } from "react";
import { Asset } from "livepeer/models/components";
import { Collapsible } from "@/components/ui/collapsible";
import { SplitsCollaboratorsForm } from "./SplitsCollaboratorsForm";
import { Users } from "lucide-react";
import { VIDEO_GENRES } from "@/lib/constants/video-genres";

type CreateDetailsAndUploadProps = {
    onPressNext: (formData: TVideoMetaForm, livepeerAsset: Asset) => void;
};

const CreateDetailsAndUpload = ({ onPressNext }: CreateDetailsAndUploadProps) => {
    const [livepeerAsset, setLivepeerAsset] = useState<Asset | null>(null);
    const [uploadedAssetId, setUploadedAssetId] = useState<string | null>(null);

    const form = useForm<TVideoMetaForm>({
        mode: "onChange",
        defaultValues: {
            title: "",
            description: "",
            location: "",
            category: "",
            ticker: "",
            collaborators: []
        },
    });

    const onSubmit = (data: TVideoMetaForm) => {
        if (!livepeerAsset || !uploadedAssetId) {
            // Show error or toast
            return;
        }

        // Prepend '$' to the ticker
        const formattedData = {
            ...data,
            ticker: `$${data.ticker}`
        };

        onPressNext(formattedData, livepeerAsset);
    };

    const isFormValid = form.formState.isValid;
    const isUploadComplete = !!livepeerAsset && !!uploadedAssetId;
    const canProceed = isFormValid && isUploadComplete;

    return (
        <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row gap-8">
                {/* Left Column: Details Form */}
                <div className="flex-1 lg:max-w-xl">
                    <Form {...form}>
                        <form id="details-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <div>
                                <h4 className="text-xl font-semibold mb-6">Video Details</h4>
                                <div className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="title"
                                        rules={{ required: true }}
                                        render={({ field }) => (
                                            <FormItem>
                                                <Label>Title</Label>
                                                <FormControl>
                                                    <Input placeholder="Video Title" {...field} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="description"
                                        rules={{ required: true, maxLength: 1000 }}
                                        render={({ field }) => (
                                            <FormItem>
                                                <Label>Description</Label>
                                                <FormControl>
                                                    <div className="relative">
                                                        <textarea
                                                            className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y pb-6"
                                                            placeholder="Video Description (Markdown supported)"
                                                            maxLength={1000}
                                                            {...field}
                                                        />
                                                        <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                                                            {field.value?.length || 0}/1000
                                                        </div>
                                                    </div>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="location"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <Label>Location</Label>
                                                    <FormControl>
                                                        <Input placeholder="Location" {...field} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="category"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <Label>Genre</Label>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select Genre" />
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
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name="ticker"
                                        rules={{
                                            required: "Ticker is required",
                                            pattern: { value: /^[A-Z0-9]+$/, message: "Uppercase alphanumeric only" }
                                        }}
                                        render={({ field }) => (
                                            <FormItem>
                                                <Label>Content Coin Ticker</Label>
                                                <FormControl>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                                                            $
                                                        </span>
                                                        <Input
                                                            placeholder="VID1"
                                                            maxLength={10}
                                                            {...field}
                                                            className="pl-7 uppercase"
                                                            onChange={(e) => {
                                                                const value = e.target.value.toUpperCase();
                                                                field.onChange(value);
                                                            }}
                                                        />
                                                    </div>
                                                </FormControl>
                                                {form.formState.errors.ticker && <p className="text-xs text-red-500">{form.formState.errors.ticker.message}</p>}
                                            </FormItem>
                                        )}
                                    />

                                    {/* Revenue Splits Section */}
                                    <div className="pt-2">
                                        <Collapsible
                                            trigger={
                                                <div className="flex items-center gap-2">
                                                    <Users className="h-4 w-4" />
                                                    <span>Revenue Splits (Optional)</span>
                                                </div>
                                            }
                                        >
                                            <SplitsCollaboratorsForm
                                                collaborators={form.watch("collaborators") || []}
                                                onChange={(collaborators) => {
                                                    form.setValue("collaborators", collaborators, { shouldValidate: true });
                                                }}
                                            />
                                        </Collapsible>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </Form>
                </div>

                {/* Right Column: Upload */}
                <div className="flex-1">
                    <h4 className="text-xl font-semibold mb-6">Video File</h4>
                    <div className="bg-card border rounded-lg p-4 relative">
                        <FileUpload
                            onFileSelect={() => {
                                setLivepeerAsset(null);
                                setUploadedAssetId(null);
                            }}
                            onFileUploaded={(id) => setUploadedAssetId(id)}
                            onAssetReady={(asset) => setLivepeerAsset(asset)}
                            hideNavigation={true}
                        />
                    </div>
                </div>
            </div>

            <div className="mt-8 flex justify-end">
                <Button
                    size="lg"
                    disabled={!canProceed}
                    onClick={form.handleSubmit(onSubmit)}
                >
                    Create & Continue
                </Button>
            </div>
        </div >
    );
};

export default CreateDetailsAndUpload;
