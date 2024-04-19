import React from "react";
import { Metadata } from "next";
import Content from "../../components/Content/Content";

export const metadata: Metadata = {
  title: "Creative TV",
  description: "The way content should be",
  metadataBase: new URL('https://creativeplatform.xyz'),
  openGraph: {
    title: "Creative TV",
    description: "The way content should be",
    type: "website",
    url: "https://tv.creativeplatform.xyz",
    images: [
      {
        url: 'https://bafkreicsmowyquojavdt6lyq7a6mgub3ae7fseprt3dcwqk2asqth4nm6y.ipfs.nftstorage.link/',
        width: 875,
        height: 875,
        alt: 'Creative Membership',
      },
    ],
    locale: "en_US",
  },

}

export default function Home() {
   
  return (
      <main className="p-4 pb-5 min-h-[100vh] flex items-center justify-center container max-w-screen-xl mx-auto">
        <div className="py-10">
          <Content />
        </div>
      </main>
  );
}