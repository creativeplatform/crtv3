import Link from "next/link";
import Image from "next/image";
import { SITE_LOGO } from "@/context/context";

export default function Component() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t bg-[#F7F7F7] dark:bg-gray-950 dark:border-gray-800 py-4 md:py-2.5">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0">
          <Link href="/" className="flex items-center" prefetch={false}>
            <Image
              src={SITE_LOGO}
              alt="Creative Logo"
              width={20}
              height={20}
              className="object-contain w-5 h-5"
            />
            <h1
              className="text-md ml-2 dark:text-white text-gray-900"
              style={{ fontFamily: "ConthraxSb-Regular , sans-serif" }}
            >
              CREATIVE
            </h1>
          </Link>

          <Link
            href="https://creativeplatform.xyz"
            prefetch={false}
            className="text-xs text-gray-500 dark:text-gray-400 text-center md:text-left \
              hover:text-red-600 dark:hover:text-red-400 focus-visible:text-red-600 dark:focus-visible:text-red-400 \
              transition-colors duration-300 ease-in-out"
          >
            © {currentYear} Creative Platform, Inc. All rights reserved.
          </Link>
        </div>
      </div>
    </footer>
  );
}
