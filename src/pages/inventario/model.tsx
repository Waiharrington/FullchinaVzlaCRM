 
import { type Ingredient } from '../../lib/dataService'
import { normalizeForSearch } from '../../lib/textFormat'

export const ITEMS_PER_PAGE = 8
export type InventoryModal = 'view' | 'edit' | 'adjust' | null

export function getIngredientCategory(ing: Ingredient): 'raw' | 'packaging' | 'beverages' | 'portions' {
  if (['por', 'porcion', 'porción', 'porciones'].includes(ing.unitSymbol.toLowerCase())) return 'portions'
  if (ing.inventoryClass === 'beverage') return 'beverages'
  if (ing.inventoryClass === 'packaging') return 'packaging'
  const name = normalizeForSearch(ing.name)
  // Detección inteligente de Bebidas
  if (
    name.includes('agua') ||
    name.includes('refresco') ||
    name.includes('soda') ||
    name.includes('coca') ||
    name.includes('pepsi') ||
    name.includes('chinotto') ||
    name.includes('colita') ||
    name.includes('jugo') ||
    name.includes('malta') ||
    name.includes('cerveza') ||
    name.includes('polar') ||
    name.includes('red bull') ||
    name.includes('monster') ||
    name.includes('bebida') ||
    name.includes('te ') ||
    name.includes('té ') ||
    name.includes('gatorade') ||
    name.includes('sangria')
  ) {
    return 'beverages'
  }
  // Detección inteligente de Empaques y Descartables
  if (
    name.includes('empaque') ||
    name.includes('bolsa') ||
    name.includes('envase') ||
    name.includes('caja') ||
    name.includes('vaso') ||
    name.includes('cubierto') ||
    name.includes('cuchillo') ||
    name.includes('cuchara') ||
    name.includes('tenedor') ||
    name.includes('servilleta') ||
    name.includes('vianda') ||
    name.includes('tapa') ||
    name.includes('sticker') ||
    name.includes('papel') ||
    name.includes('aluminio') ||
    name.includes('porta') ||
    name.includes('pitillo') ||
    name.includes('delivery')
  ) {
    return 'packaging'
  }
  return 'raw'
}

export type InventoryDisplayGroup = 'proteins' | 'vegetables' | 'starches' | 'seasonings' | 'beverages' | 'portions' | 'packaging' | 'other'

export const INVENTORY_GROUP_ORDER: Record<InventoryDisplayGroup, number> = {
  proteins: 10,
  vegetables: 20,
  starches: 30,
  seasonings: 40,
  beverages: 50,
  portions: 60,
  packaging: 70,
  other: 80,
}

export const DISPLAY_GROUP_KEYWORDS: Array<{ group: Exclude<InventoryDisplayGroup, 'beverages' | 'portions' | 'packaging'>; keywords: string[] }> = [
  { group: 'proteins', keywords: ['pollo', 'huevo', 'carne', 'carne de res', 'cerdo', 'chuleta', 'jamon', 'camaron', 'pescado', 'atun', 'salchicha', 'chorizo', 'tocineta', 'bacon', 'marisco', 'calamar'] },
  { group: 'vegetables', keywords: ['cebolla', 'tomate', 'lechuga', 'zanahoria', 'pimenton', 'aji', 'ajo', 'cebollin', 'repollo', 'pepino', 'brocoli', 'coliflor', 'cilantro', 'perejil', 'papa', 'yuca', 'calabacin', 'berenjena', 'vainita'] },
  { group: 'starches', keywords: ['arroz', 'harina', 'pasta', 'tallarin', 'fideo', 'vermicelli', 'pan', 'maizena', 'maiz', 'avena', 'azucar'] },
  { group: 'seasonings', keywords: ['aceite', 'salsa', 'soya', 'vinagre', 'sal', 'pimienta', 'ajinomoto', 'condimento', 'especia', 'caldo', 'mayonesa', 'ketchup', 'mostaza'] },
]

export function getInventoryDisplayGroup(ing: Ingredient): InventoryDisplayGroup {
  const category = getIngredientCategory(ing)
  if (category === 'beverages') return 'beverages'
  if (category === 'portions') return 'portions'
  if (category === 'packaging') return 'packaging'
  const name = normalizeForSearch(ing.name)
  return DISPLAY_GROUP_KEYWORDS.find(({ keywords }) => keywords.some(keyword => name.includes(keyword)))?.group ?? 'other'
}

