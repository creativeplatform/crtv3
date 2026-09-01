import { Big_Shoulders } from "next/font/google";

/** Variable font — weight is controlled via Tailwind (e.g. font-bold). */
export const bigShoulders = Big_Shoulders({
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: false,
});
