import { formatSpanishText } from './textFormat'

/**
 * Copy editorial del catálogo público. Las reglas por fragmento permiten que
 * funcionen tanto con los nombres nuevos como con los nombres históricos que
 * ya existen en la base de datos.
 */
const DESCRIPTION_RULES: Array<[RegExp, string]> = [
  [/imperdible|super promo/i, 'Arroz frito con pollo, jamón, cerdo y camarón; pollo agridulce, lumpias y refresco de un litro.'],
  [/promo\s*tr[ií]o/i, 'Dos platos de arroz con jamón y pollo, pollo agridulce, lumpias y refresco de un litro.'],
  [/pa.?\s*todos|combo familiar|promo familiar|xl familiar|2 kilos/i, 'Arroz con jamón, pollo y huevo, pollo agridulce, papas fritas y refresco para compartir.'],
  [/de panas|compartir/i, 'Arroz con camarón y pollo, pollo agridulce, chop suey veggie y lumpias para compartir.'],
  [/pa.?\s*dos tallarines/i, 'Dos platos de tallarines mixtos con pollo, carne y lomito con vegetales al wok.'],
  [/canton[eé]s especial/i, 'Arroz cantonés con proteínas, vegetales al wok y lumpias crujientes.'],
  [/pa.?\s*m[ií]/i, 'Arroz frito con pollo y jamón, preparado al wok con nuestro toque secreto.'],
  [/pa.?\s*ti/i, 'Arroz frito con jamón y cuatro piezas de pollo agridulce.'],
  [/plato\s*1|costilla.*lumpia/i, 'Arroz frito con jamón y pollo, costilla agridulce y una lumpia.'],
  [/plato\s*2|costilla.*papas/i, 'Arroz frito con jamón y pollo, costilla agridulce y papas fritas.'],
  [/plato\s*3/i, 'Arroz frito con pollo y jamón, chop suey y una lumpia.'],
  [/tr[ií]o/i, 'Arroz frito con pollo y jamón, pollo agridulce y una lumpia.'],
  [/d[uú]o/i, 'Arroz frito con camarones al wok y una lumpia crujiente.'],
  [/full kilo.*especial|arroz frito especial.*full kilo/i, 'Arroz frito especial al wok con pollo, cerdo, camarón y el toque secreto de Full China.'],
  [/medio kilo.*especial|arroz frito especial.*medio kilo/i, 'Arroz frito especial con pollo, cerdo, camarón y el toque secreto de Full China.'],
  [/arroz con camarones y pollo/i, 'Arroz frito al wok con pollo, camarón y el toque secreto de Full China.'],
  [/cl[aá]sico/i, 'Arroz frito con jamón, pollo y huevo, acompañado de un refresco.'],
  [/full kilo canton[eé]s|canton[eé]s.*full kilo/i, 'Arroz cantonés con pollo, carne, jamón, camarón, chuleta ahumada y vegetales al wok.'],
  [/medio kilo canton[eé]s|canton[eé]s.*medio kilo/i, 'Arroz cantonés con pollo, carne, jamón, camarón, chuleta ahumada y vegetales al wok.'],
  [/especial de la casa|chuleta ahumada/i, 'Arroz blanco salteado con cebollín, vegetales y chuleta ahumada.'],
  [/bolo[nñ]esa/i, 'Pasta con salsa boloñesa artesanal de carne, tomates frescos y hierbas aromáticas.'],
  [/full tentaci[oó]n/i, 'Vermicelli salteado con carne, vegetales y salsa artesanal de tomate.'],
  [/pasta con camarones.*ajillo/i, 'Pasta cremosa con camarones salteados al ajillo y hierbas frescas.'],
  [/tallar[ií]n(?:es)? .*especial/i, 'Tallarines al wok con vegetales, pollo, carne y camarón.'],
  [/tallar[ií]n(?:es)? .*mixto/i, 'Tallarines al wok con vegetales, pollo y carne.'],
  [/tallar[ií]n(?:es)? .*veggie/i, 'Tallarines al wok con vegetales frescos.'],
  [/tallar[ií]n(?:es)?.*vermicelli.*camar[oó]n/i, 'Tallarines o vermicelli al wok con camarones y salsa de la casa.'],
  [/vermicelli.*full/i, 'Vermicelli al wok con vegetales, pollo, carne y camarón.'],
  [/vermicelli.*mixto/i, 'Vermicelli al wok con vegetales, pollo y carne.'],
  [/vermicelli.*veggie/i, 'Vermicelli salteado al wok con vegetales frescos.'],
  [/chop\s*suey.*veggie/i, 'Vegetales frescos salteados al wok, llenos de sabor.'],
  [/chop\s*suey.*mixto/i, 'Vegetales salteados al wok con pollo y carne.'],
  [/chop\s*suey.*full|chop\s*suey.*especial/i, 'Vegetales salteados al wok con pollo, carne y camarón.'],
  [/lomito con vegetales/i, 'Lomito salteado al wok con calabacín, zanahoria, cebolla, pimentón y brócoli.'],
  [/camar[oó]n(es)? salteado/i, 'Camarones salteados al wok con vegetales frescos.'],
  [/camar[oó]n(es)?.*crispy/i, 'Camarones empanizados y crujientes, acompañados de salsa de la casa.'],
  [/pollo agridulce/i, 'Piezas de pollo bañadas en nuestra salsa agridulce.'],
  [/picadera/i, 'Costilla, pollo agridulce, lumpias y papas fritas para compartir.'],
  [/teque|tequeño/i, 'Tequeños de queso, dorados y crujientes.'],
  [/lumpia.*especial/i, 'Lumpias crujientes con la proteína que elijas.'],
  [/lumpia/i, 'Lumpias crujientes rellenas de vegetales.'],
  [/nugget/i, 'Nuggets crujientes acompañados de papas fritas.'],
  [/papa(s)? frita/i, 'Papas fritas doradas y crujientes.'],
  [/costilla.*agridulce/i, 'Costillas de cerdo marinadas y bañadas en salsa agridulce.'],
  [/costilla.*sal.*pimienta/i, 'Costillas de cerdo sazonadas con sal y pimienta, fritas al punto.'],
  [/sopa.*fideo/i, 'Sopa china de fideos con vegetales, pollo, carne, camarón y huevo.'],
  [/wanton/i, 'Fajitas rellenas de camarón y pollo, fritas o al vapor, con salsa para untar.'],
  [/refresco/i, 'Refresco bien frío, disponible en los sabores de la casa.'],
  [/lipton/i, 'Té Lipton frío, disponible en limón o durazno.'],
  [/agua/i, 'Agua mineral fría.'],
  [/extra.*camar[oó]n/i, 'Añade camarón salteado al wok a tu plato.'],
  [/extra.*(pollo|jam[oó]n|cerdo|carne)/i, 'Añade proteína salteada al wok a tu plato.'],
]

export function getEditorialDescription(name: string, fallback = '') {
  const normalizedName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const rule = DESCRIPTION_RULES.find(([pattern]) => {
    const normalizedPattern = new RegExp(pattern.source.normalize('NFD').replace(/[\u0300-\u036f]/g, ''), pattern.flags)
    return pattern.test(name) || normalizedPattern.test(normalizedName)
  })
  return formatSpanishText(rule?.[1] ?? fallback)
}
