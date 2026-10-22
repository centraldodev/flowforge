import { Check, X } from 'lucide-react';

type Props = {
  message: string;
  onClose: () => void;
};

export function Toast({ message, onClose }: Props) {
  if (!message) return null;

  return (
    <div className="toast" role="status">
      <Check size={16} />
      {message}
      <button aria-label="Fechar notificação" onClick={onClose}>
        <X size={15} />
      </button>
    </div>
  );
}
