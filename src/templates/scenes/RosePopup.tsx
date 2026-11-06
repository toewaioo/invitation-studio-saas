import type { ReactNode } from 'react';
import type { Photo } from '../../types';

interface Props {
  photos: Photo[];
  renderPortrait: (photo: Photo | undefined) => ReactNode;
}

export default function RosePopup({ photos, renderPortrait }: Props) {
  return (
    <div className="rose-scene">
      <div className="rose-orbit" />
      <div className="rose-petal petal-one" />
      <div className="rose-petal petal-two" />
      <div className="rose-petal petal-three" />
      <div className="rose-photo" hidden={!photos.length}>
        {renderPortrait(photos[Math.min(1, photos.length - 1)])}
      </div>
      <div className="rose-ribbon">Two hearts. One beautiful story.</div>
    </div>
  );
}
