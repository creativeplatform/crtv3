"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { NewsletterModal } from "./NewsletterModal";
import { getPublicationPosts, getSubscriberCount, getCoinData } from "@/app/actions/paragraph";
import { useUser } from "@/lib/wallet/react";
import { Newspaper } from "lucide-react";
import { logger } from '@/lib/utils/logger';


const COIN_ADDRESS = "0x81ced3c6e7058c1fe8d9b6c5a2435a65a4593292";

export default function DearCreativePublications() {
    const user = useUser();
    const [posts, setPosts] = useState<any[]>([]);
    const [subscriberCount, setSubscriberCount] = useState<number | null>(null);
    const [coinData, setCoinData] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [activePost, setActivePost] = useState<any | null>(null);

    useEffect(() => {
        let isMounted = true;

        async function fetchData() {
            try {
                setLoading(true);
                // Fetch public posts
                const fetchedPosts = await getPublicationPosts(3);

                if (isMounted) {
                    setPosts(fetchedPosts);
                }

                // If user is connected, fetch authenticated/extra data
                if (user) {
                    const [count, coin] = await Promise.all([
                        getSubscriberCount(),
                        getCoinData(COIN_ADDRESS)
                    ]);

                    if (isMounted) {
                        setSubscriberCount(count);
                        setCoinData(coin);
                    }
                }
            } catch (error) {
                logger.error("Failed to fetch Paragraph data:", error);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        fetchData();

        return () => {
            isMounted = false;
        };
    }, [user]);

    const handlePostClick = (e: React.MouseEvent, post: any) => {
        e.preventDefault();
        setActivePost(post);
    };

    if (loading && posts.length === 0) {
        return (
            <div className="mx-auto w-full max-w-7xl py-8">
                <div className="mb-8 text-center">
                    <div className="mx-auto h-8 w-64 bg-muted animate-pulse rounded"></div>
                    <div className="mx-auto mt-2 h-4 w-32 bg-muted animate-pulse rounded"></div>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex flex-col h-full overflow-hidden rounded-xl bg-card border border-border/50 shadow-sm">
                            <div className="relative aspect-video w-full bg-muted animate-pulse" />
                            <div className="p-5 flex flex-col flex-grow space-y-3">
                                <div className="h-6 w-3/4 bg-muted animate-pulse rounded" />
                                <div className="space-y-2">
                                    <div className="h-4 w-full bg-muted animate-pulse rounded" />
                                    <div className="h-4 w-2/3 bg-muted animate-pulse rounded" />
                                </div>
                                <div className="mt-auto pt-4 border-t border-border/50 flex items-center">
                                    <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (posts.length === 0) return null;

    return (
        <div className="mx-auto w-full max-w-7xl py-8">
            <div className="mb-8 text-center">
                <h3 className="mb-4 text-2xl font-bold flex items-center justify-center gap-2">

                    <span className="animate-pulse">
                        <Newspaper className="inline-block h-10 w-10 text-[#EC407A]" />
                    </span>
                    <span className="text-primary">LATEST ARTICLES</span>
                </h3>

                {/* Stats Section - Visible only when connected */}
                {user && (
                    <div className="mb-6 flex justify-center gap-8 text-sm items-center">
                        {subscriberCount !== null && (
                            <div className="flex flex-col items-center">
                                <span className="font-bold text-xl">{subscriberCount}</span>
                                <span className="text-muted-foreground">Subscribers</span>
                            </div>
                        )}
                        {coinData && coinData.metadata && (
                            <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                                {coinData.metadata.image ? (
                                    <Image
                                        src={coinData.metadata.image}
                                        alt={coinData.metadata.name || "Coin"}
                                        width={40}
                                        height={40}
                                        className="rounded-full mb-1 border border-border/50"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-secondary mb-1 flex items-center justify-center border border-border/50">
                                        <span className="text-xs">🪙</span>
                                    </div>
                                )}
                                <span className="text-muted-foreground font-medium">{coinData.metadata.name || "Coin"}</span>
                            </div>
                        )}
                    </div>
                )}

                <Link
                    href="https://news.creativeplatform.xyz"
                    target="_blank"
                    className="text-sm text-primary hover:underline transition-colors block mt-2"
                >
                    Read all issues
                </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) => (
                    <Link
                        key={post.id}
                        href={`https://news.creativeplatform.xyz/${post.slug}`}
                        onClick={(e) => handlePostClick(e, post)}
                        className="group block h-full cursor-pointer"
                    >
                        <div className="relative flex h-full flex-col overflow-hidden rounded-xl bg-card border border-border/50 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-md">
                            {/* Image */}
                            <div className="relative aspect-video w-full overflow-hidden bg-muted">
                                {post.imageUrl || post.cover_image ? (
                                    <Image
                                        src={post.imageUrl || post.cover_image}
                                        alt={post.title}
                                        fill
                                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full w-full bg-secondary text-muted-foreground">
                                        No Image
                                    </div>
                                )}
                                {/* Overlay Gradient */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 transition-opacity group-hover:opacity-40" />

                                <div className="absolute bottom-4 left-4 right-4">
                                    <span className="inline-block rounded-full bg-primary/90 px-2 py-1 text-xs font-medium text-primary-foreground backdrop-blur-sm">
                                        {new Date(Number(post.publishedAt)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex flex-grow flex-col p-5">
                                <h3 className="mb-2 text-xl font-bold leading-tight tracking-tight text-card-foreground group-hover:text-primary transition-colors line-clamp-2">
                                    {post.title}
                                </h3>
                                {post.subtitle && (
                                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-grow">
                                        {post.subtitle}
                                    </p>
                                )}
                                <div className="mt-auto pt-4 flex items-center text-sm font-medium text-primary/80 group-hover:text-primary group-hover:translate-x-1 transition-all">
                                    Read Article
                                    <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

            {activePost && (
                <NewsletterModal
                    isOpen={!!activePost}
                    onClose={() => setActivePost(null)}
                    postUrl={`https://news.creativeplatform.xyz/${activePost.slug}`}
                    title={activePost.title}
                />
            )}
        </div>
    );
}
