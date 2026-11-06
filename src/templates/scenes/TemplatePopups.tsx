import type { ComponentType, ReactNode } from 'react';
import type { Design, Photo } from '../../types';
import NoirPopup from './NoirPopup';
import RosePopup from './RosePopup';

export interface TemplatePopupProps {
  photos: Photo[];
  arrivalPhoto: Photo | undefined;
  renderPortrait: (photo: Photo | undefined) => ReactNode;
}

const templatePopups: Partial<Record<Design, ComponentType<TemplatePopupProps>>> = {
  noir: NoirPopup,
  rose: RosePopup,
};

export default function TemplatePopups(props: TemplatePopupProps & { design: Design }) {
  const Popup = templatePopups[props.design];
  return Popup ? <Popup {...props} /> : null;
}
