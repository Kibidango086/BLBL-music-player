import React from 'react'

interface IconProps {
  name: string
  size?: number
  filled?: boolean
  weight?: number
  className?: string
  style?: React.CSSProperties
}

/**
 * Google Material Symbols Rounded icon component.
 * Usage: <Icon name="search" size={24} />
 */
export function Icon({ name, size = 20, filled = false, weight = 400, className = '', style }: IconProps) {
  const opsz = Math.max(20, Math.min(48, size))
  return (
    <span
      className={`material-symbols-rounded ${className}`}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${opsz}`,
        ...style
      }}
    >
      {name}
    </span>
  )
}

export default Icon
