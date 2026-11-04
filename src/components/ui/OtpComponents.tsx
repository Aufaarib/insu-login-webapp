interface SheetHeaderProps {
  title: string
  onClose: () => void
}

export const SheetHeader = ({ title, onClose }: SheetHeaderProps) => (
  <div className="flex flex-row items-center justify-between">
    <p className="text-ink text-[16px] font-[600]">{title}</p>
    <button onClick={onClose} className="text-ink">
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M15 5L5 15M5 5L15 15"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  </div>
)

interface RadioCardProps {
  selected: boolean
  onClick: () => void
  title: string
  subtitle: string
}

export const RadioCard = ({
  selected,
  onClick,
  title,
  subtitle,
}: RadioCardProps) => (
  <button
    onClick={onClick}
    className={`flex flex-row items-center justify-between border rounded-[12px] p-[14px] ${
      selected ? 'border-primary' : 'border-line'
    }`}
  >
    <div className="flex flex-col items-start gap-[2px]">
      <p className="text-ink text-[14px] font-[600]">{title}</p>
      <p className="text-muted text-[12px]">{subtitle}</p>
    </div>
    <div
      className={`w-[18px] h-[18px] rounded-full border flex items-center justify-center ${
        selected ? 'border-primary' : 'border-subtle'
      }`}
    >
      {selected && <div className="w-[10px] h-[10px] rounded-full bg-primary"></div>}
    </div>
  </button>
)

interface OtpInputGroupProps {
  value: string[]
  onChange: (index: number, value: string) => void
  onKeyDown: (index: number, e: React.KeyboardEvent<HTMLInputElement>) => void
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void
  inputRefs: React.MutableRefObject<Array<HTMLInputElement | null>>
  error?: boolean
}

export const OtpInputGroup = ({
  value,
  onChange,
  onKeyDown,
  onPaste,
  inputRefs,
  error = false,
}: OtpInputGroupProps) => (
  <div className="flex flex-row justify-center gap-[8px]">
    {value.map((digit, idx) => (
      <input
        key={idx}
        ref={(el) => {
          inputRefs.current[idx] = el
        }}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete={idx === 0 ? 'one-time-code' : 'off'}
        aria-label={`Digit ${idx + 1}`}
        aria-invalid={error}
        value={digit}
        onChange={(e) => onChange(idx, e.target.value)}
        onKeyDown={(e) => onKeyDown(idx, e)}
        onFocus={(e) => e.target.select()}
        onPaste={onPaste}
        className={`w-[40px] h-[40px] rounded-[8px] border-[1.5px] bg-white text-center text-[16px] font-[400] text-ink caret-primary outline-none transition-colors focus:border-primary ${
          error ? 'border-primary' : digit ? 'border-subtle' : 'border-line'
        }`}
      />
    ))}
  </div>
)
