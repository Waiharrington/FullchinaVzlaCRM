import { categoryLabel } from './menuCategories'
import { type MenuProductGroup } from './menuGrouping'
import { normalizeForSearch } from './textFormat'

// Conectores que la gente escribe pero que no distinguen un plato de otro.
const CONNECTORS = new Set(['a', 'al', 'con', 'de', 'del', 'e', 'el', 'en', 'la', 'las', 'los', 'para', 'por', 'un', 'una', 'y'])
const NAME_WEIGHT = 6
const CATEGORY_WEIGHT = 3
const DESCRIPTION_WEIGHT = 1

const words = (value: string) => normalizeForSearch(value).split(/[^a-z0-9ñ/]+/).filter(Boolean)

/** "lumpias" y "lumpia", "camarones" y "camarón" deben encontrar lo mismo. */
function stem(word: string) {
  if (word.length > 5 && /[^aeiou]es$/.test(word)) return word.slice(0, -2)
  if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1)
  return word
}

function searchTokens(term: string) {
  const all = words(term)
  const meaningful = all.filter(word => !CONNECTORS.has(word))
  return meaningful.length > 0 ? meaningful : all
}

function matches(word: string, token: string) {
  if (word.startsWith(token) || stem(word) === stem(token)) return true
  return token.length >= 3 && (word.includes(token) || word.startsWith(stem(token)))
}

function distanceWithin(a: string, b: string, limit: number) {
  if (Math.abs(a.length - b.length) > limit) return false
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    previous = current
  }
  return previous[b.length] <= limit
}

/** Perdona errores al escribir ("aroz", "tallarines" con una letra de más). */
function almostMatches(word: string, token: string) {
  if (token.length < 4 || word.length < 4) return false
  return distanceWithin(stem(word), stem(token), token.length >= 7 ? 2 : 1)
}

function indexGroup(group: MenuProductGroup) {
  const products = group.variants.map(variant => variant.product)
  return [
    { weight: NAME_WEIGHT, words: words([group.name, ...group.variants.flatMap(variant => [variant.label, variant.product.name])].join(' ')) },
    { weight: CATEGORY_WEIGHT, words: words([group.category, categoryLabel(group.category), ...products.flatMap(product => product.categories.flatMap(category => [category, categoryLabel(category)]))].join(' ')) },
    { weight: DESCRIPTION_WEIGHT, words: words(products.map(product => product.description || '').join(' ')) },
  ]
}

/**
 * Busca en todo el menú, sin importar la categoría abierta: todas las palabras
 * deben aparecer, en cualquier orden, y los platos cuyo nombre coincide van
 * primero. Si nada coincide, intenta de nuevo perdonando errores al escribir.
 */
export function searchMenuGroups(groups: MenuProductGroup[], term: string): MenuProductGroup[] {
  const tokens = searchTokens(term)
  if (tokens.length === 0) return groups
  const indexed = groups.map(group => ({ group, fields: indexGroup(group) }))

  const run = (isMatch: (word: string, token: string, weight: number) => boolean) => indexed
    .map(({ group, fields }) => {
      let score = 0
      for (const token of tokens) {
        const field = fields.find(candidate => candidate.words.some(word => isMatch(word, token, candidate.weight)))
        if (!field) return null
        score += field.weight
      }
      return { group, score }
    })
    .filter((entry): entry is { group: MenuProductGroup; score: number } => entry !== null)
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.group)

  const exact = run(matches)
  return exact.length > 0 ? exact : run((word, token, weight) => matches(word, token) || (weight > DESCRIPTION_WEIGHT && almostMatches(word, token)))
}
