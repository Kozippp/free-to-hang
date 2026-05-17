import React, { useEffect, useState } from 'react';
import type { ComponentType } from 'react';

type WelcomeVideoModalProps = {
  visible: boolean;
  onClose: () => void;
};

/**
 * Loads WelcomeVideoModal (and expo-video + 51MB asset) only when the modal should show.
 */
export default function LazyWelcomeVideoModal(props: WelcomeVideoModalProps) {
  const [ModalComponent, setModalComponent] =
    useState<ComponentType<WelcomeVideoModalProps> | null>(null);

  useEffect(() => {
    if (!props.visible) return;

    let cancelled = false;
    void import('@/components/WelcomeVideoModal').then((mod) => {
      if (!cancelled) {
        setModalComponent(() => mod.default);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [props.visible]);

  if (!props.visible || !ModalComponent) {
    return null;
  }

  return <ModalComponent visible={props.visible} onClose={props.onClose} />;
}
