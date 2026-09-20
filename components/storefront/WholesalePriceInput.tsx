"use client";

interface WholesalePriceInputProps {
  value: string;
  disabled?: boolean;
  error?: string | null;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

export default function WholesalePriceInput({
  value,
  disabled = false,
  error = null,
  onChange,
  onBlur,
}: WholesalePriceInputProps) {
  return (
    <div className="w-full max-w-[10rem]">
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-sm text-gray-500">
          ₹
        </span>
        <input
          type="number"
          inputMode="decimal"
          min="0.01"
          max="9999999.99"
          step="0.01"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder="0.00"
          className={`w-full rounded-md border bg-white py-1.5 pl-6 pr-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-gray-50 ${
            error
              ? "border-red-400 focus:border-red-500"
              : "border-gray-300 focus:border-indigo-500"
          }`}
          aria-invalid={Boolean(error)}
        />
      </div>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
