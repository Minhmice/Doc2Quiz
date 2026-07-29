"use client";

type StoredImageProps = Readonly<{
  mediaId: string;
  alt: string;
  className?: string;
}>;

/** Legacy media IDs are no longer resolved after v2 text-only cleanup. */
export function StoredImage(_props: StoredImageProps) {
  return null;
}
