import {
  type CategoryIllustrationSlug,
  categoryIllustrationSrc,
  categoryIllustrationSrcSvg,
  resolveCategoryIllustrationSlug,
} from "@/lib/config/categoryIllustrations"
import "@/styles/category-illustrations.css"

type CategoryIllustrationProps = {
  slug: CategoryIllustrationSlug | string
  /** Display size — scenes authored at 120×120. */
  size?: number
  priority?: boolean
  className?: string
  alt?: string
}

export function CategoryIllustration({
  slug,
  size = 104,
  priority = false,
  className = "",
  alt,
}: CategoryIllustrationProps) {
  const resolved = resolveCategoryIllustrationSlug(String(slug))
  const webp = categoryIllustrationSrc(resolved)
  const svg = categoryIllustrationSrcSvg(resolved)
  const label = alt || `${resolved.replace(/-/g, " ")} category`

  return (
    <div
      className={`cat-illus-frame ${className}`}
      style={{ width: size, height: size }}
    >
      <div className="cat-illus-frame__scene">
        <picture>
          <source srcSet={webp} type="image/webp" />
          <img
            src={svg}
            alt={label}
            width={size}
            height={size}
            className="cat-illus-frame__img"
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            draggable={false}
          />
        </picture>
      </div>
    </div>
  )
}
