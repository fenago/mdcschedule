interface MDCLogoProps {
  width?: number;
  height?: number;
  className?: string;
}

export function MDCLogo({ width = 50, height = 50, className }: MDCLogoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={width}
      height={height}
      className={className}
      aria-label="Miami Dade College Logo"
    >
      {/* MDC Shield/Book shape */}
      <defs>
        <linearGradient id="mdcGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#094579" />
          <stop offset="100%" stopColor="#6894db" />
        </linearGradient>
      </defs>

      {/* Main shield */}
      <path
        d="M50 5 L90 20 L90 55 Q90 85 50 95 Q10 85 10 55 L10 20 Z"
        fill="url(#mdcGradient)"
      />

      {/* Inner book pages */}
      <path
        d="M30 35 L50 30 L50 70 L30 65 Z"
        fill="white"
        opacity="0.9"
      />
      <path
        d="M70 35 L50 30 L50 70 L70 65 Z"
        fill="white"
        opacity="0.7"
      />

      {/* Book spine */}
      <line x1="50" y1="30" x2="50" y2="70" stroke="#094579" strokeWidth="2" />

      {/* MDC Text */}
      <text
        x="50"
        y="85"
        textAnchor="middle"
        fill="white"
        fontSize="12"
        fontWeight="bold"
        fontFamily="Arial, sans-serif"
      >
        MDC
      </text>
    </svg>
  );
}
