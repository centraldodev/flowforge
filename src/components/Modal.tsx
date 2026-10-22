import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  className?: string;
  children: ReactNode;
};

export function Modal({ isOpen, onClose, title, className = '', children }: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        <button className="close" aria-label="Fechar" onClick={onClose}>
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
  );
}
