import careLogo from "@/assets/care-logo.png.asset.json";

interface CareLogoProps {
  size?: number;
  className?: string;
}

/**
 * CARE System logo (image-based). Renders the uploaded brand mark.
 * Use `size` for square pixel dimensions.
 */
export function CareLogo({ size = 56, className }: CareLogoProps) {
  return (
    <img
      src={careLogo.url}
      alt="CARE System"
      width={size}
      height={size}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        display: "block",
      }}
    />
  );
}
