export const VIDEO_GENRES = [
  { value: "Pop", label: "Pop" },
  { value: "Rock", label: "Rock" },
  { value: "Hip-Hop/Rap", label: "Hip-Hop/Rap" },
  { value: "R&B/Soul", label: "R&B/Soul" },
  { value: "EDM", label: "EDM" },
  { value: "Country", label: "Country" },
  { value: "Jazz", label: "Jazz" },
  { value: "Blues", label: "Blues" },
  { value: "Classical", label: "Classical" },
  { value: "Folk", label: "Folk" },
  { value: "Reggae", label: "Reggae" },
  { value: "Latin", label: "Latin" },
  { value: "Metal", label: "Metal" },
  { value: "Original", label: "Original" },
  { value: "Podcast", label: "Podcast" },
  { value: "Education", label: "Education" },
  { value: "World", label: "World Music" },
  { value: "Hackathon", label: "Hackathon" },
] as const;

export type VideoGenreValue = (typeof VIDEO_GENRES)[number]["value"];

export const VIDEO_GENRE_VALUES: VideoGenreValue[] = VIDEO_GENRES.map(
  (genre) => genre.value,
);

export function getVideoGenreLabel(value: string): string {
  const match = VIDEO_GENRES.find((genre) => genre.value === value);
  return match?.label ?? value;
}
