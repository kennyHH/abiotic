import { useEffect, useState } from 'react';

export type ImageFallbackKind =
  | 'soup'
  | 'food'
  | 'chemistry'
  | 'distillation'
  | 'ingredient';

interface ItemImageProps {
  src: string;
  alt?: string;
  fallbackKind?: ImageFallbackKind;
  className?: string;
  loading?: 'lazy' | 'eager';
  fetchPriority?: 'high' | 'low' | 'auto';
  width?: number;
  height?: number;
}

export function ItemImage({
  src,
  alt = '',
  fallbackKind = 'ingredient',
  className,
  loading = 'lazy',
  fetchPriority,
  width,
  height,
}: ItemImageProps) {
  const fallbackSrc = `images/fallbacks/${fallbackKind}.svg`;
  const [currentSrc, setCurrentSrc] = useState(src || fallbackSrc);

  useEffect(() => {
    setCurrentSrc(src || fallbackSrc);
  }, [src, fallbackSrc]);

  return (
    <img
      src={currentSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding="async"
      onError={() => {
        if (currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        }
      }}
    />
  );
}
