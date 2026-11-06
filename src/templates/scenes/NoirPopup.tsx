import type { ReactNode } from 'react';
import type { Photo } from '../../types';

interface Props {
  photos: Photo[];
  arrivalPhoto: Photo | undefined;
  renderPortrait: (photo: Photo | undefined) => ReactNode;
}

export default function NoirPopup({ photos, arrivalPhoto, renderPortrait }: Props) {
  return (
    <div className="noir-scene">
      <div className="deco-wing wing-left" />
      <div className="deco-wing wing-right" />
      <div className="deco-portrait" hidden={!photos.length}>
        {renderPortrait(arrivalPhoto)}
        <div className="deco-foil" />
      </div>
      <div className="deco-plinth">THE GOLDEN VOW</div>
    </div>
  );
}
