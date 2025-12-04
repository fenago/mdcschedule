interface MDCLogoProps {
  width?: number;
  height?: number;
  className?: string;
}

export function MDCLogo({ width = 50, height = 50, className }: MDCLogoProps) {
  return (
    <img
      src="/mdc-logo.svg"
      alt="Miami Dade College Logo"
      width={width}
      height={height}
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
}
