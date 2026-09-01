import React, { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import Link from "next/link";
import { Slash } from "lucide-react";
import { PredictionList } from "@/components/predictions/PredictionList";
import { PredictionListSkeleton } from "@/components/predictions/PredictionListSkeleton";

export const metadata: Metadata = {
  title: "Predictions",
  description: "Make predictions and bet on outcomes using Reality.eth.",
  openGraph: {
    title: "Predictions",
    description: "Make predictions and bet on outcomes using Reality.eth.",
    type: "website",
    images: [
      {
        url: "/images/prediction_banner.png",
        width: 800,
        height: 300,
        alt: "The best way to predict the future is to create it.",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Predictions",
    description: "Make predictions and bet on outcomes using Reality.eth.",
    images: ["/images/prediction_banner.png"],
  },
};

export default function PredictPage() {
  return (
    <div className="min-h-screen px-2 sm:px-6 py-6">
      <div className="relative w-full h-44 mb-8 overflow-hidden rounded-lg">
        <Image
          src="/images/prediction_banner.svg"
          alt="The best way to predict the future is to create it."
          fill
          style={{ objectFit: "cover" }}
          priority
        />
      </div>
      <div className="my-5 p-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">
                  <span role="img" aria-label="home">
                    🏠
                  </span>{" "}
                  Home
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <Slash />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink>
                <BreadcrumbPage>Predict</BreadcrumbPage>
              </BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div>
        <h1 className="text-lg sm:text-xl font-bold">Predictions</h1>
      </div>
      <div className="mt-5">
        <p className="text-base sm:text-lg">
          Make predictions and bet on outcomes using Reality.eth.
        </p>
      </div>
      <div className="p-4">
        <div className="flex flex-col gap-4 w-full max-w-full">
          <Suspense fallback={<PredictionListSkeleton />}>
            <PredictionList />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
