export type ChonesEventStatus = "active" | "upcoming";

type ChonesEventBase = {
  slug: string;
  title: string;
  description?: string;
};

export type ChonesEvent =
  | (ChonesEventBase & { status: "active"; href: string })
  | (ChonesEventBase & { status: "upcoming" });

export const CHONES_EVENTS: ChonesEvent[] = [
  {
    slug: "hack-beta",
    title: "HACKATHON BETA",
    description: "July 20–24, 2026 · Virtual",
    status: "active",
    href: "/chones/hack-beta",
  },
];
