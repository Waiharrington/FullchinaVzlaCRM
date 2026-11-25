/* Platos recortados de sus fotos, para que floten fuera de la tarjeta.
   La clave sale de la propia foto: si cambian la foto de un plato, deja de
   coincidir y la carta muestra la foto nueva dentro de un plato redondo. */
const CUTOUTS = new Set([
  '0312db18',
  '08eb1f85',
  '0a386e48',
  '0b2c8c9d',
  '14450766',
  '1bec2bb1',
  '28ddf4cc',
  '33fadaf3',
  '36db33c1',
  '3d41416d',
  '41db2c04',
  '4bcef83a',
  '4d747e76',
  '4f9a0a7a',
  '54d83fb0',
  '5986399e',
  '5bc23178',
  '5f792dbd',
  '6472a0b8',
  '6f4f4f7d',
  '719e1857',
  '81848a9f',
  '83f3f78a',
  '844becde',
  '844de242',
  '89fddfc2',
  '908c38cb',
  'a46c1d82',
  'a6d1d84a',
  'a79e9da6',
  'b4cf19e0',
  'b65fdd1e',
  'b8e60734',
  'bee3c213',
  'c9c16243',
  'cc58defd',
  'd1912417',
  'd65e1c6a',
  'd82a1cdc',
  'e78d7e13',
  'f195c178',
  'fb5f0d4e',
  'fbb2e467',
])

const cache = new Map<string, string | null>()

function dishKey(source: string) {
  let hash = 2166136261
  const step = Math.max(1, Math.floor(source.length / 400))
  for (let i = 0; i < source.length; i += step) {
    hash ^= source.charCodeAt(i)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  hash ^= source.length & 0xffff
  hash = Math.imul(hash, 16777619) >>> 0
  return hash.toString(16).padStart(8, '0')
}

/** Ruta del plato recortado, o null si esa foto no tiene recorte. */
export function cutoutFor(imageUrl: string | null | undefined) {
  if (!imageUrl) return null
  const known = cache.get(imageUrl)
  if (known !== undefined) return known
  const key = dishKey(imageUrl)
  const path = CUTOUTS.has(key) ? `/optimized/pedir-v2/platos/${key}.webp` : null
  cache.set(imageUrl, path)
  return path
}
