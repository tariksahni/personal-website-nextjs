import { useEffect, useState } from 'react'
import { getSignedUrls } from 'Lib/wardrobe/data'

/** Resolves image_path -> signed URL for the given items (batched, cached 1h in memory). */
export function useSignedUrls(items) {
  const [urls, setUrls] = useState({})
  const key = (items || [])
    .map((i) => i.image_path)
    .filter(Boolean)
    .sort()
    .join('|')

  useEffect(() => {
    if (!key) return undefined
    let cancelled = false
    const load = () =>
      getSignedUrls(key.split('|'))
        .then((map) => {
          if (!cancelled) setUrls((prev) => ({ ...prev, ...map }))
        })
        .catch(() => {})
    load()
    // Signed URLs last 1h; refresh periodically so a long-open tab keeps working.
    const timer = setInterval(load, 45 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [key])

  return urls
}
