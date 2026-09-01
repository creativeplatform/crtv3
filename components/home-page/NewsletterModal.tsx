"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { DearCreativeTradeButton } from "./DearCreativeTradeButton";


interface NewsletterModalProps {
    isOpen: boolean;
    onClose: () => void;
    postUrl: string;
    title: string;
}

export function NewsletterModal({
    isOpen,
    onClose,
    postUrl,
    title,
}: NewsletterModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden sm:max-w-5xl">
                <DialogHeader className="px-6 py-4 flex flex-row items-center justify-between border-b bg-background z-10">
                    <DialogTitle className="truncate pr-4 flex-1">{title}</DialogTitle>
                    <DialogDescription className="sr-only">
                        Read the full publication in this modal or open it in a new tab.
                    </DialogDescription>
                    <div className="flex items-center gap-2">
                        <DearCreativeTradeButton />
                        <Button variant="ghost" size="sm" asChild className="hidden sm:flex" onClick={(e) => e.stopPropagation()}>
                            <Link href={postUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Open in New Tab
                            </Link>
                        </Button>
                    </div>
                </DialogHeader>
                <div className="flex-1 w-full bg-white relative">
                    <iframe
                        src={postUrl}
                        className="w-full h-full border-0 absolute inset-0"
                        title={title}
                        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                        loading="lazy"
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
