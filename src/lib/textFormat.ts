// En nombres de comidas solo los conectores se mantienen en minúscula.
// Palabras como "Para", "Mi" o "Con" sí forman parte del título y van con inicial mayúscula.
// Convenciones editoriales del español: artículos, preposiciones y
// conjunciones permanecen en minúscula salvo cuando abren el título.
const TITLE_LOWER_WORDS = new Set([
  'a', 'al', 'con', 'de', 'del', 'e', 'el', 'en', 'la', 'las', 'lo', 'los',
  'o', 'para', 'por', 'un', 'una', 'y', 'u',
])
const TITLE_PRESERVE_WORDS = new Map([
  ['mk', 'MK'],
  ['fk', 'FK'],
  ['xl', 'XL'],
  ['7up', '7Up'],
])

const ACCENTED_WORDS: Array<[RegExp, string | ((match: string, suffix?: string) => string)]> = [
  [/camaron(es)?/gi, (_match, suffix = '') => suffix ? 'camarones' : 'camarón'],
  [/cantones/gi, 'cantonés'],
  [/proteina(s)?/gi, (_match, suffix = '') => suffix ? 'proteínas' : 'proteína'],
  [/cebollin/gi, 'cebollín'],
  [/tallarin(es)?/gi, (_match, suffix = '') => suffix ? 'tallarines' : 'tallarín'],
  [/porcion(es)?/gi, (_match, suffix = '') => suffix ? 'porciones' : 'porción'],
  [/racion(es)?/gi, (_match, suffix = '') => suffix ? 'raciones' : 'ración'],
  [/direccion(es)?/gi, (_match, suffix = '') => suffix ? 'direcciones' : 'dirección'],
  [/telefono(s)?/gi, (_match, suffix = '') => suffix ? 'teléfonos' : 'teléfono'],
  [/ubicacion(es)?/gi, (_match, suffix = '') => suffix ? 'ubicaciones' : 'ubicación'],
  [/informacion(es)?/gi, (_match, suffix = '') => suffix ? 'informaciones' : 'información'],
  [/preparacion(es)?/gi, (_match, suffix = '') => suffix ? 'preparaciones' : 'preparación'],
  [/indicacion(es)?/gi, (_match, suffix = '') => suffix ? 'indicaciones' : 'indicación'],
  [/opcion(es)?/gi, (_match, suffix = '') => suffix ? 'opciones' : 'opción'],
  [/promocion(es)?/gi, (_match, suffix = '') => suffix ? 'promociones' : 'promoción'],
  [/descripcion(es)?/gi, (_match, suffix = '') => suffix ? 'descripciones' : 'descripción'],
  [/categoria(s)?/gi, (_match, suffix = '') => suffix ? 'categorías' : 'categoría'],
  [/configuracion(es)?/gi, (_match, suffix = '') => suffix ? 'configuraciones' : 'configuración'],
  [/produccion(es)?/gi, (_match, suffix = '') => suffix ? 'producciones' : 'producción'],
  [/operacion(es)?/gi, (_match, suffix = '') => suffix ? 'operaciones' : 'operación'],
  [/administracion(es)?/gi, (_match, suffix = '') => suffix ? 'administraciones' : 'administración'],
  [/electronico(s)?/gi, 'electrónico$1'],
  [/automaticamente/gi, 'automáticamente'],
  [/credito(s)?/gi, (_match, suffix = '') => suffix ? 'créditos' : 'crédito'],
  [/periodo(s)?/gi, (_match, suffix = '') => suffix ? 'períodos' : 'período'],
  [/metodo(s)?/gi, (_match, suffix = '') => suffix ? 'métodos' : 'método'],
  [/numero(s)?/gi, (_match, suffix = '') => suffix ? 'números' : 'número'],
  [/\bpimenton(es)?\b/gi, (_match, suffix = '') => suffix ? 'pimentones' : 'pimentón'],
  [/\bcalabacin(es)?\b/gi, (_match, suffix = '') => suffix ? 'calabacines' : 'calabacín'],
  [/\bbrocoli\b/gi, 'brócoli'],
  [/\bjamon(es)?\b/gi, (_match, suffix = '') => suffix ? 'jamones' : 'jamón'],
  // Acepta tanto el plural habitual como el singular y cualquier dato legado
  // que llegue sin la ñ desde el catálogo antiguo.
  [/\btequeno(s)?\b/gi, (_match, suffix = '') => suffix ? 'tequeños' : 'tequeño'],
  [/\bcafe\b/gi, 'café'],
  [/\bcomun\b/gi, 'común'],
  [/\btambien\b/gi, 'también'],
  [/\baun\b/gi, 'aún'],
  [/clasico(s)?/gi, (_match, suffix = '') => suffix ? 'clásicos' : 'clásico'],
  [/duo/gi, 'dúo'],
  [/trio/gi, 'trío'],
  [/menu(s)?/gi, (_match, suffix = '') => suffix ? 'menús' : 'menú'],
  [/chopsuey/gi, 'chop suey'],
  [/boloñesa/gi, 'boloñesa'],
  [/bolonesa/gi, 'boloñesa'],
  [/agridulce/gi, 'agridulce'],
  [/papas/gi, 'papas'],
  [/teque\s*[- ]\s*teque/gi, 'teque-teque'],
  [/vermiceli/gi, 'vermicelli'],
  [/vegetales/gi, 'vegetales'],
  [/camaron(e?s)?/gi, (_match, suffix = '') => suffix ? 'camarones' : 'camarón'],
]

/** Corrige tildes frecuentes conservando el uso de mayúsculas original. */
export function formatSpanishText(value: string) {
  return ACCENTED_WORDS.reduce((text, [pattern, replacement]) => text.replace(pattern, (match, suffix = '') => {
    const corrected = typeof replacement === 'function' ? replacement(match, suffix) : replacement
    if (match === match.toUpperCase()) return corrected.toUpperCase()
    if (match[0] === match[0].toUpperCase()) return corrected.charAt(0).toUpperCase() + corrected.slice(1)
    return corrected
  }), value)
}

/** Normaliza nombres de platos para que nuevos y existentes sigan la misma regla editorial. */
export function formatProductTitle(name: string) {
  const corrected = formatSpanishText(name.trim())
    .replace(/[’']/g, '’')
    // Contracciones habituales del menú, siempre con apóstrofe tipográfico.
    .replace(/\bpa\s*’?\s*m[ií]\b/gi, 'Pa’ Mí')
    .replace(/\bpa\s*’?\s*ti\b/gi, 'Pa’ Ti')
    .replace(/\bpa\s*’?\s*todos\b/gi, 'Pa’ Todos')
    .replace(/\bpa\s*’?\s*dos\s+tallarines\b/gi, 'Pa’ Dos Tallarines')
    .replace(/\bmedio kilo\b/gi, 'Medio Kilo')
  return corrected.split(/\s+/).map((word, index) => {
    const lower = word.toLocaleLowerCase('es-VE')
    if (index > 0 && TITLE_LOWER_WORDS.has(lower)) return lower
    if (lower === 'pa’') return 'Pa’'
    if (TITLE_PRESERVE_WORDS.has(lower)) return TITLE_PRESERVE_WORDS.get(lower)!
    return lower.charAt(0).toLocaleUpperCase('es-VE') + lower.slice(1)
  }).join(' ')
}
