"use client";

import React from "react";
import HeroSection from "./HeroSection";
import { ChannelBannersCarousel } from "@/components/channels/ChannelBannersCarousel";
// import { TopChart } from "./TopChart";
// import FeaturedVideo from './Featured';
import { TopVideos } from "./TopVideos";
import { useAuthStateMonitor } from '@/lib/hooks/accountkit/useAuthStateMonitor';
import DearCreativePublications from "./DearCreativePublications";

const NonLoggedInView: React.FC = () => {
  // Monitor auth state for logout/timeout scenarios
  useAuthStateMonitor();

  return (
    <div>
      <HeroSection />
      <div className="w-full max-w-7xl mx-auto py-3 px-4 sm:px-6">
        <ChannelBannersCarousel />
      </div>
      {/* <TopChart /> */}
      {/* <FeaturedVideo /> */}
      <TopVideos />
      <DearCreativePublications />
    </div>
  );
};

export default NonLoggedInView;
