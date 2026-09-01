"use client";

import React, { useState } from "react";
import { Shield } from "lucide-react";
import { Button } from "../ui/button";
import { LicensePurchaseDialog } from "./LicensePurchaseDialog";

interface BuyIPButtonProps {
  ipId: string;
  licenseTermsId: string;
  videoTitle: string;
  className?: string;
}

export function BuyIPButton({
  ipId,
  licenseTermsId,
  videoTitle,
  className = "",
}: BuyIPButtonProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const handleOpen = () => {
    buttonRef.current?.blur();
    setOpen(true);
  };

  if (!ipId || !licenseTermsId) return null;

  return (
    <>
      <Button
        ref={buttonRef}
        className={`cursor-pointer hover:scale-105 transition-all text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 px-3 py-2 h-auto whitespace-nowrap ${className}`}
        aria-label={`Buy IP license for ${videoTitle}`}
        variant="ghost"
        onClick={handleOpen}
      >
        <div className="flex items-center gap-1.5">
          <Shield className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">IP</span>
        </div>
      </Button>

      <LicensePurchaseDialog
        ipId={ipId}
        licenseTermsId={licenseTermsId}
        videoTitle={videoTitle}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
