export function SpinnerOverlay({ message }: { message: string }) {
  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-white/70"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 rounded bg-white px-4 py-2 shadow">
        <svg
          aria-hidden="true"
          className="h-5 w-5 animate-spin text-blue-500"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span className="text-sm text-gray-700">{message}</span>
      </div>
    </div>
  );
}
