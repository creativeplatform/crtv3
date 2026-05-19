"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { motion, type Variants } from "framer-motion";
import { Vote } from "lucide-react";

function ProposalListSkeleton() {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 },
    },
  };
  const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 100, damping: 12 },
    },
  };
  const shimmer = {
    animate: {
      background: [
        "linear-gradient(90deg, var(--skeleton-from) 0%, var(--skeleton-to) 50%, var(--skeleton-from) 100%)",
        "linear-gradient(90deg, var(--skeleton-from) 100%, var(--skeleton-to) 50%, var(--skeleton-from) 0%)",
      ],
      backgroundSize: ["200% 100%", "200% 100%"],
      backgroundPosition: ["0% 0%", "200% 0%"],
    },
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "linear" as const,
    },
  };
  return (
    <div className="relative">
      <motion.div
        className="absolute right-4 top-20 md:right-8 md:top-24 opacity-10 pointer-events-none"
        animate={{ y: [0, -15, 0], rotate: [0, 5, 0, -5, 0] }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut" as const,
        }}
      >
        <Vote className="w-16 h-16 md:w-24 md:h-24 text-primary" />
      </motion.div>
      <motion.div
        className="grid gap-4 sm:gap-5 md:gap-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {[...Array(3)].map((_, i) => (
          <motion.div key={i} variants={itemVariants}>
            <Card className="p-4 sm:p-5 md:p-6 overflow-hidden relative border-border/60 hover:border-border transition-colors duration-300">
              <div className="space-y-3 md:space-y-4">
                <motion.div {...shimmer}>
                  <Skeleton className="h-6 sm:h-7 w-2/3 rounded-md" />
                </motion.div>
                <div className="space-y-2">
                  <motion.div {...shimmer}>
                    <Skeleton className="h-4 w-full rounded-md" />
                  </motion.div>
                  <motion.div {...shimmer}>
                    <Skeleton className="h-4 w-5/6 rounded-md" />
                  </motion.div>
                  <motion.div {...shimmer}>
                    <Skeleton className="h-4 w-4/6 rounded-md" />
                  </motion.div>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-border/30">
                  <motion.div {...shimmer}>
                    <Skeleton className="h-3 w-24 rounded-full" />
                  </motion.div>
                  <span className="text-muted-foreground/30">•</span>
                  <motion.div {...shimmer}>
                    <Skeleton className="h-3 w-20 rounded-full" />
                  </motion.div>
                  <span className="text-muted-foreground/30">•</span>
                  <motion.div {...shimmer}>
                    <Skeleton className="h-3 w-16 rounded-full" />
                  </motion.div>
                </div>
                <div className="flex gap-3 mt-3">
                  <motion.div {...shimmer}>
                    <Skeleton className="h-9 w-24 rounded-md" />
                  </motion.div>
                  <motion.div {...shimmer}>
                    <Skeleton className="h-9 w-24 rounded-md" />
                  </motion.div>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>
      <style jsx global>{`
        :root {
          --skeleton-from: hsl(var(--background));
          --skeleton-to: hsl(var(--muted));
        }
        .dark {
          --skeleton-from: hsl(var(--background));
          --skeleton-to: hsl(var(--muted-foreground) / 0.2);
        }
      `}</style>
    </div>
  );
}

export { ProposalListSkeleton };
