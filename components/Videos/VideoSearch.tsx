"use client";

import React, { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, SlidersHorizontal } from "lucide-react";
import { PredictiveSearchInput } from "@/components/search/PredictiveSearchInput";
import { VIDEO_GENRES } from "@/lib/constants/video-genres";

interface VideoSearchProps {
  onSearchChange: (search: string) => void;
  onCategoryChange: (category: string) => void;
  onSortChange: (sort: 'created_at' | 'views_count' | 'likes_count' | 'updated_at') => void;
  initialCategory?: string;
  initialSort?: 'created_at' | 'views_count' | 'likes_count' | 'updated_at';
}

const VIDEO_CATEGORIES = [
  { value: "all", label: "All Genres" },
  ...VIDEO_GENRES,
];

const SORT_OPTIONS = [
  { value: "created_at", label: "Latest" },
  { value: "likes_count", label: "Most Liked" },
  { value: "updated_at", label: "Recently Updated" },
];

export function VideoSearch({
  onSearchChange,
  onCategoryChange,
  onSortChange,
  initialCategory = "all",
  initialSort = "created_at",
}: VideoSearchProps) {
  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState(initialSort);
  const [showFilters, setShowFilters] = useState(false);
  const [searchResetKey, setSearchResetKey] = useState(0);
  const [hasSearch, setHasSearch] = useState(false);

  const handleCategoryChange = useCallback((value: string) => {
    setCategory(value);
    onCategoryChange(value === "all" ? "" : value);
  }, [onCategoryChange]);

  const handleSortChange = useCallback((value: string) => {
    const sortValue = value as 'created_at' | 'views_count' | 'likes_count' | 'updated_at';
    setSort(sortValue);
    onSortChange(sortValue);
  }, [onSortChange]);

  const clearSearch = useCallback(() => {
    setSearchResetKey((k) => k + 1);
    setHasSearch(false);
    onSearchChange("");
  }, [onSearchChange]);

  return (
    <div className="mb-6 space-y-4 px-2 sm:px-0">
      <div className="relative">
        <PredictiveSearchInput
          scope="videos"
          placeholder="Search videos by title or description..."
          resetKey={searchResetKey}
          onQueryChange={(q) => {
            setHasSearch(!!q);
            onSearchChange(q);
          }}
          showClear={false}
          inputClassName="pr-24"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-2 z-10">
          {hasSearch && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSearch}
              className="h-7 px-2"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="h-7 px-2"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <label htmlFor="genre-select" className="mb-2 block text-sm font-medium">Genre</label>
            <Select value={category} onValueChange={handleCategoryChange}>
              <SelectTrigger id="genre-select">
                <SelectValue placeholder="Select genre" />
              </SelectTrigger>
              <SelectContent>
                {VIDEO_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label htmlFor="sort-select" className="mb-2 block text-sm font-medium">Sort By</label>
            <Select value={sort} onValueChange={handleSortChange}>
              <SelectTrigger id="sort-select">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
