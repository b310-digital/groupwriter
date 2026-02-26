import { XMarkIcon } from '@heroicons/react/24/solid';
import { ReactNode } from 'react';

const Modal = ({
  header,
  isOpen,
  onToggle,
  className,
  children
}: {
  header: string;
  isOpen: boolean;
  onToggle?: () => void;
  className?: string;
  children: ReactNode;
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={`flex max-h-[85vh] flex-col bg-white rounded-lg shadow-lg ${className ?? 'w-96'}`}
      >
        <div className="flex shrink-0 justify-between items-center p-6 pb-4">
          <h2 id="modal-title" className="text-xl font-semibold">
            {header}
          </h2>
          {onToggle && (
            <button
              onClick={onToggle}
              aria-label="Close"
              className="text-neutral-500 hover:text-neutral-700 border-none bg-transparent"
            >
              <XMarkIcon className="size-5" />
            </button>
          )}
        </div>
        <div className="overflow-y-auto px-6 pb-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
