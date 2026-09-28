import Image from "next/image";

type CognitaLogoProps = {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  wordmarkClassName?: string;
  showText?: boolean;
  subtitle?: string;
};

export function CognitaLogo({
  className = "flex items-center gap-3",
  markClassName = "h-12 w-40",
  textClassName = "text-white",
  subtitle,
}: CognitaLogoProps) {
  return (
    <div className={className}>
      <Image
        src="/cognita-logo.png"
        alt="Cognita"
        width={420}
        height={160}
        priority
        className={`${markClassName} object-contain drop-shadow-[0_6px_14px_rgba(0,36,120,0.28)]`}
      />
      {subtitle ? <span className={`block text-xs font-semibold tracking-wide opacity-90 ${textClassName}`}>{subtitle}</span> : null}
    </div>
  );
}
