"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";

export interface ShoppableProductKit {
  brandName: string;
  brandHandle: string;
  brandLogoUrl: string;
  productImageUrl: string;
  purchaseUrl: string;
  title: string;
}

export interface ShoppableAnnotation {
  id: string;
  startTime: number;
  endTime: number;
  boundingBox: [number, number, number, number];
  productKit: ShoppableProductKit;
}

interface ShoppableOverlayProps {
  activeAnnotations: ShoppableAnnotation[];
  campaignId: string;
  /** Full annotation list for image preload (not only currently active). */
  allAnnotations?: ShoppableAnnotation[];
}

export function ShoppableOverlay({
  activeAnnotations,
  campaignId,
  allAnnotations,
}: ShoppableOverlayProps) {
  useEffect(() => {
    const source = allAnnotations ?? activeAnnotations;
    for (const item of source) {
      const img1 = new Image();
      img1.src = item.productKit.productImageUrl;
      const img2 = new Image();
      img2.src = item.productKit.brandLogoUrl;
    }
  }, [allAnnotations, activeAnnotations]);

  return (
    <div className="absolute inset-0 pointer-events-none z-10 p-4 md:p-6 overflow-hidden">
      <AnimatePresence>
        {activeAnnotations.map((item) => {
          const [ymin, xmin] = item.boundingBox;
          const left = Math.min(xmin / 10, 72);
          const top = Math.min(ymin / 10, 65);

          let destinationUrl = item.productKit.purchaseUrl;
          try {
            const parsed = new URL(item.productKit.purchaseUrl);
            parsed.searchParams.set("utm_source", "creativetv");
            parsed.searchParams.set("utm_medium", "overlay");
            parsed.searchParams.set("utm_campaign", campaignId);
            destinationUrl = parsed.toString();
          } catch {
            // Keep raw fallback URL if malformed
          }

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.9, y: 12 }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
                left: `${left}%`,
                top: `${top}%`,
              }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="pointer-events-auto absolute w-64 md:w-72 bg-[#121212] border border-[#2A2A2A] rounded-2xl p-3 shadow-2xl text-white"
            >
              <div className="flex items-center space-x-2.5 mb-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.productKit.brandLogoUrl}
                  alt={item.productKit.brandName}
                  className="w-7 h-7 rounded-full border border-zinc-700 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-xs truncate leading-tight">
                    {item.productKit.brandName}
                  </p>
                  <p className="text-zinc-400 text-[10px] truncate">
                    @{item.productKit.brandHandle}
                  </p>
                </div>
              </div>

              <div className="w-full h-28 bg-zinc-900 rounded-lg overflow-hidden mb-2 border border-zinc-800 flex items-center justify-center p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.productKit.productImageUrl}
                  alt={item.productKit.title}
                  className="max-h-full max-w-full object-contain"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-xs font-medium text-zinc-300 truncate">
                  {item.productKit.title}
                </span>
                <a
                  href={destinationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 bg-white text-black px-3 py-1.5 rounded-full text-xs font-bold hover:bg-zinc-200 transition shrink-0"
                >
                  <ShoppingBag size={12} />
                  <span>Shop</span>
                </a>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
