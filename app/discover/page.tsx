"use client";

import { useState } from "react";
import VideoCardGrid from "@/components/Videos/VideoCardGrid";
import { VideoSearch } from "@/components/Videos/VideoSearch";
import LivestreamGrid from "@/components/Live/LivestreamGrid";
import { ChannelBannersCarousel } from "@/components/channels/ChannelBannersCarousel";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Slash } from "lucide-react";

const AllVideosContent: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sortBy, setSortBy] = useState<'created_at' | 'views_count' | 'likes_count' | 'updated_at'>('created_at');

  return (
    <div className="min-h-screen px-0 py-6 sm:px-6 sm:py-6">
      <div className="mb-8 rounded-lg bg-white dark:bg-gray-800/60 p-8 shadow-md">
        <h1 className="mb-6 text-center text-4xl font-bold text-gray-800 dark:text-gray-200">
          Discover Amazing Music Videos
        </h1>
        <p className="mb-8 text-center text-gray-600 dark:text-gray-400">
          Explore our collection of creative music videos from talented creators
          worldwide. Find something inspiring and share it with your friends!
        </p>
      </div>
      <div className="mx-auto mb-8 max-w-7xl px-4 sm:px-0">
        <ChannelBannersCarousel />
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
              <BreadcrumbLink asChild>
                <Link href="/discover">Discover</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Live Streams Section - Public (hidden when none are live) */}
      <LivestreamGrid
        heading="Live Now"
        hideWhenEmpty
        className="mb-8"
      />

      {/* Videos Section */}
      <div>
        <h2 className="my-4 text-2xl font-bold">Discover Videos</h2>

        {/* Search and Filter Controls */}
        <VideoSearch
          onSearchChange={setSearchQuery}
          onCategoryChange={setCategory}
          onSortChange={setSortBy}
          initialCategory={category}
          initialSort={sortBy}
        />

        {/* Video Grid */}
        <VideoCardGrid
          searchQuery={searchQuery}
          category={category}
          orderBy={sortBy}
        />
      </div>
      {/* Livestream Section - Commented out */}
      {/* <div>
        <h2 className="my-4 text-2xl font-bold">All Videos</h2>
        <LivestreamGrid />
      </div> */}
    </div>
  );
};

export default AllVideosContent;
