import { useState, useRef, useEffect } from 'react'

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  wrapperClassName?: string
}

export function LazyImage({ src, wrapperClassName, className, ...props }: LazyImageProps) {
  const [inView, setInView] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const img = imgRef.current
    if (!img) return

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setInView(true)
            observer.disconnect()
          }
        },
        { rootMargin: '100px' }
      )
      observer.observe(img)
      return () => observer.disconnect()
    } else {
      setInView(true)
    }
  }, [])

  return (
    <div className={wrapperClassName} style={{ position: 'relative', overflow: 'hidden' }}>
      {inView ? (
        <img
          ref={imgRef}
          src={src}
          className={`${className} ${loaded ? '' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          loading="lazy"
          decoding="async"
          {...props}
        />
      ) : (
        <div ref={imgRef} className={className} />
      )}
      {!loaded && inView && (
        <div
          className="absolute inset-0 bg-accent animate-pulse"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}
    </div>
  )
}