import type { ProductModifierGroup } from './dataService'

export type PublicModifierSelection = Record<string, number>

export function countModifierSelections(group: ProductModifierGroup, selection: PublicModifierSelection): number {
  return group.options.reduce((total, option) => total + (selection[option.id] ?? 0), 0)
}

export function getModifierSelectionError(
  groups: ProductModifierGroup[],
  selection: PublicModifierSelection,
): ProductModifierGroup | null {
  const knownOptionIds = new Set(groups.flatMap(group => group.options.map(option => option.id)))
  if (Object.entries(selection).some(([id, quantity]) => !knownOptionIds.has(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 30)) {
    return null
  }
  return groups.find(group => {
    const count = countModifierSelections(group, selection)
    const repeatedOption = !group.allowRepeat && group.options.some(option => (selection[option.id] ?? 0) > 1)
    return repeatedOption || count < group.minSelections || (group.maxSelections !== null && count > group.maxSelections)
  }) ?? null
}

export function hasInvalidModifierSelection(groups: ProductModifierGroup[], selection: PublicModifierSelection): boolean {
  const knownOptionIds = new Set(groups.flatMap(group => group.options.map(option => option.id)))
  return Object.entries(selection).some(([id, quantity]) => !knownOptionIds.has(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 30)
}

export function calculateModifierTotal(groups: ProductModifierGroup[], selection: PublicModifierSelection): number {
  return groups.reduce((total, group) => total + group.options.reduce(
    (groupTotal, option) => groupTotal + option.price * (selection[option.id] ?? 0), 0,
  ), 0)
}

export function appendRequiredOrderMetadata(primaryNotes: string, requiredMetadata: string, limit = 500): string {
  if (requiredMetadata.length >= limit) return requiredMetadata.slice(-limit)
  const separator = primaryNotes && requiredMetadata ? ' · ' : ''
  const available = Math.max(0, limit - requiredMetadata.length - separator.length)
  return `${primaryNotes.slice(0, available)}${separator}${requiredMetadata}`
}
