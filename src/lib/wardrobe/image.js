// Client-side image resizing for the wardrobe app.
// Every photo is downscaled to <= 1024px (longest side) and re-encoded as JPEG
// before it is uploaded or sent to a function — keeps storage + API costs small.

const DEFAULT_MAX = 1024
const DEFAULT_QUALITY = 0.8

function decodeError(file) {
  const name = file && file.name ? `"${file.name}"` : 'this image'
  const looksHeic = file && (/hei[cf]$/i.test(file.name || '') || /hei[cf]/i.test(file.type || ''))
  return new Error(
    looksHeic
      ? `Couldn't read ${name}: this browser can't open HEIC photos. Please use a JPEG or PNG (on iPhone, upload from your phone or set Camera → Formats → Most Compatible).`
      : `Couldn't read ${name}. Please use a JPEG or PNG image.`
  )
}

function loadWithImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight, close() {} })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(decodeError(file))
    }
    img.src = url
  })
}

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close && bmp.close() }
    } catch (e) {
      // Some Safari versions reject the options bag or the format; fall back to <img>.
    }
  }
  return loadWithImageElement(file)
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error('Could not read the resized image.'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Resize an image File/Blob to a JPEG.
 * @returns {Promise<{blob: Blob, base64: string, mediaType: 'image/jpeg', width: number, height: number}>}
 *          base64 has NO "data:" prefix.
 */
export async function resizeImage(file, max = DEFAULT_MAX, quality = DEFAULT_QUALITY) {
  if (!file) throw new Error('No image selected.')
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error(`"${file.name || 'File'}" is not an image.`)
  }

  const decoded = await decode(file)
  try {
    if (!decoded.width || !decoded.height) throw decodeError(file)
    const scale = Math.min(1, max / Math.max(decoded.width, decoded.height))
    const width = Math.max(1, Math.round(decoded.width * scale))
    const height = Math.max(1, Math.round(decoded.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Image processing is not supported in this browser.')
    ctx.fillStyle = '#ffffff' // flatten transparent PNGs onto white
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(decoded.source, 0, 0, width, height)

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) throw decodeError(file)
    const base64 = await blobToBase64(blob)
    return { blob, base64, mediaType: 'image/jpeg', width, height }
  } finally {
    decoded.close()
  }
}
