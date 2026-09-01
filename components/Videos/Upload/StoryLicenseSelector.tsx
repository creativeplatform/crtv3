"use client";

import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";
import { PIL_TEMPLATES, type StoryLicenseTerms } from "@/lib/types/story-protocol";
import { useWipPrice } from "@/lib/hooks/story/useWipPrice";

interface StoryLicenseSelectorProps {
  enabled: boolean;
  selectedLicense: StoryLicenseTerms | null;
  onEnabledChange: (enabled: boolean) => void;
  onLicenseChange: (license: StoryLicenseTerms | null) => void;
}

export function StoryLicenseSelector({
  enabled,
  selectedLicense,
  onEnabledChange,
  onLicenseChange,
}: StoryLicenseSelectorProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    selectedLicense?.templateId || ""
  );
  const [mintingFee, setMintingFee] = useState<string>(
    selectedLicense?.defaultMintingFee != null
      ? String(selectedLicense.defaultMintingFee)
      : "0"
  );

  const { price: wipUsdPrice, loading: wipPriceLoading } = useWipPrice();

  const feeNum = Number(mintingFee);
  const feeUsd =
    wipUsdPrice != null && Number.isFinite(feeNum) && feeNum > 0
      ? feeNum * wipUsdPrice
      : null;

  const buildTerms = (
    templateId: string,
    feeStr: string
  ): StoryLicenseTerms | null => {
    const template = PIL_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return null;
    const feeNum = Number(feeStr);
    return {
      templateId: template.id,
      commercialUse: template.terms.commercialUse ?? false,
      derivativesAllowed: template.terms.derivativesAllowed ?? false,
      derivativesAttribution: template.terms.derivativesAttribution ?? false,
      derivativesApproval: template.terms.derivativesApproval ?? false,
      derivativesReciprocal: template.terms.derivativesReciprocal ?? false,
      distributionMethod: template.terms.distributionMethod,
      revenueShare: template.terms.revenueShare,
      defaultMintingFee: Number.isFinite(feeNum) && feeNum > 0 ? feeNum : 0,
    };
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    onLicenseChange(buildTerms(templateId, mintingFee));
  };

  const handleFeeChange = (value: string) => {
    if (value !== "" && !/^\d*\.?\d*$/.test(value)) return;
    setMintingFee(value);
    if (selectedTemplateId) {
      onLicenseChange(buildTerms(selectedTemplateId, value));
    }
  };

  const selectedTemplate = PIL_TEMPLATES.find((t) => t.id === selectedTemplateId);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">Story Protocol IP Registration</CardTitle>
            <CardDescription>
              Register your video as an IP Asset on Story Protocol with licensing terms
            </CardDescription>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={onEnabledChange}
            aria-label="Enable Story Protocol IP registration"
          />
        </div>
      </CardHeader>

      {enabled && (
        <CardContent className="space-y-4">
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              Registering your video on Story Protocol requires an NFT to be minted first. If your
              video doesn't have an NFT yet, IP registration will be skipped. You can mint an NFT
              for your video and then register it on Story Protocol later.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="license-template">License Template</Label>
            <Select
              value={selectedTemplateId}
              onValueChange={handleTemplateChange}
              disabled={!enabled}
            >
              <SelectTrigger id="license-template">
                <SelectValue placeholder="Select a license template" />
              </SelectTrigger>
              <SelectContent>
                {PIL_TEMPLATES.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedTemplate && (
              <div className="mt-2 p-3 bg-muted rounded-md">
                <p className="text-sm font-medium mb-1">{selectedTemplate.name}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedTemplate.description}
                </p>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {selectedTemplate.terms.commercialUse && (
                    <div>✓ Commercial use allowed</div>
                  )}
                  {selectedTemplate.terms.derivativesAllowed && (
                    <div>
                      ✓ Derivatives allowed
                      {selectedTemplate.terms.derivativesAttribution && " (with attribution)"}
                      {selectedTemplate.terms.derivativesApproval && " (approval required)"}
                      {selectedTemplate.terms.derivativesReciprocal && " (reciprocal license)"}
                    </div>
                  )}
                  {!selectedTemplate.terms.derivativesAllowed && (
                    <div>✗ No derivatives allowed</div>
                  )}
                  {!selectedTemplate.terms.commercialUse && (
                    <div>✗ No commercial use</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {selectedTemplateId && (
            <div className="space-y-2">
              <Label htmlFor="minting-fee">License price (WIP / $DATA)</Label>
              <Input
                id="minting-fee"
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={mintingFee}
                onChange={(e) => handleFeeChange(e.target.value)}
                disabled={!enabled}
              />
              <p className="text-xs text-muted-foreground">
                Amount buyers pay in WIP to mint a license token. Use 0 for a free license.
              </p>
              {feeUsd != null && (
                <p className="text-xs text-muted-foreground">
                  ≈ ${feeUsd.toFixed(2)} USD
                  {wipPriceLoading && " (price loading…)"}
                </p>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

