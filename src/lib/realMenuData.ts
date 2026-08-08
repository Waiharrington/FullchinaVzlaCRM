export interface RealMenuItem {
  id: string
  name: string
  description: string
  price: number
  cost: number
  category: 'combo' | 'plato' | 'arroz' | 'noodles' | 'wok' | 'racion' | 'extra'
  emoji: string
  active: boolean
}

export const REAL_FULL_CHINA_MENU: RealMenuItem[] = [
  // --- COMBOS & SUPER PROMOS -------------------------------------------------
  {
    id: 'prod-sp01',
    name: 'Imperdible (Super Promo)',
    description: '1 full kg arroz frito especial (jamón, pollo, cerdo, camarón) + ración pollo agridulce (8 und) + ración lumpias vegetales (2 und) + refresco 1L gratis.',
    price: 19.99,
    cost: 7.80,
    category: 'combo',
    emoji: '🔥',
    active: true
  },
  {
    id: 'prod-sp02',
    name: 'Promo Trío',
    description: '2 platos tríos (arroz frito jamón y pollo + 4 piezas pollo agridulce + 2 lumpias vegetales) + bebida gratis.',
    price: 14.00,
    cost: 5.20,
    category: 'combo',
    emoji: '🍱',
    active: true
  },
  {
    id: 'prod-sp03',
    name: 'Pa\' Todos (Combo Familiar)',
    description: '1 kg arroz clásico frito (jamón, pollo, huevo) + 2 raciones pollo agridulce (16 piezas) + 300g papas fritas + refresco 1L gratis.',
    price: 22.90,
    cost: 8.50,
    category: 'combo',
    emoji: '👨‍👩‍👧‍👦',
    active: true
  },
  {
    id: 'prod-sp04',
    name: 'De Panas (Combo Compartir)',
    description: '1 kg arroz frito camarón y pollo + 12 piezas pollo agridulce + chop suey veggie + 1 ración lumpias vegetales (2 und).',
    price: 24.90,
    cost: 9.20,
    category: 'combo',
    emoji: '🥳',
    active: true
  },
  {
    id: 'prod-sp05',
    name: 'XL Familiar (2 Kilos)',
    description: '2 kg arroz chino frito (jamón, pollo, cerdo) + ración pollo agridulce (8 piezas) + chop suey + 2 refrescos.',
    price: 28.00,
    cost: 10.50,
    category: 'combo',
    emoji: '🏰',
    active: true
  },
  {
    id: 'prod-sp06',
    name: 'Pa\' Dos Tallarines',
    description: '2 platos tallarines mixto (carne y pollo) + Lomito con vegetales salteados al wok.',
    price: 18.00,
    cost: 6.80,
    category: 'combo',
    emoji: '🍜',
    active: true
  },
  {
    id: 'prod-sp07',
    name: 'Cantonés Especial',
    description: 'Full kg arroz cantonés (carne, pollo, cerdo, jamón y camarones) + ración de lumpias crujientes.',
    price: 16.50,
    cost: 6.20,
    category: 'combo',
    emoji: '🍚',
    active: true
  },

  // --- PLATOS INDIVIDUALES & EJECUTIVOS -------------------------------------
  {
    id: 'prod-pi01',
    name: 'Pa\' Mí',
    description: '350g de arroz frito especial al wok con jamón y pollo, salsas de la casa.',
    price: 3.50,
    cost: 1.20,
    category: 'plato',
    emoji: '🥡',
    active: true
  },
  {
    id: 'prod-pi02',
    name: 'Pa\' Ti',
    description: '350g de arroz frito con jamón + media ración de pollo agridulce (4 unidades).',
    price: 5.50,
    cost: 2.10,
    category: 'plato',
    emoji: '🍗',
    active: true
  },
  {
    id: 'prod-pi03',
    name: 'Plato 1 (Arroz + Lumpia + Costilla)',
    description: 'Arroz frito especial (jamón y pollo) + 1 lumpia + costilla agridulce.',
    price: 8.00,
    cost: 3.00,
    category: 'plato',
    emoji: '🍖',
    active: true
  },
  {
    id: 'prod-pi04',
    name: 'Plato 2 (Arroz + Papas + Costilla)',
    description: 'Arroz frito especial (jamón y pollo) + papas fritas + costilla agridulce.',
    price: 8.00,
    cost: 2.90,
    category: 'plato',
    emoji: '🍟',
    active: true
  },
  {
    id: 'prod-pi05',
    name: 'Plato 3 (Arroz + Chop Suey + Lumpia)',
    description: '350g de arroz frito especial con pollo y jamón + chop suey + 1 lumpia.',
    price: 7.00,
    cost: 2.50,
    category: 'plato',
    emoji: '🥦',
    active: true
  },
  {
    id: 'prod-pi06',
    name: 'El Trío (Arroz + Pollo Agridulce + Lumpia)',
    description: '350g de arroz frito especial con pollo y jamón + 2 piezas pollo agridulce + 1 lumpia.',
    price: 7.00,
    cost: 2.40,
    category: 'plato',
    emoji: '🍱',
    active: true
  },
  {
    id: 'prod-pi07',
    name: 'Dúo (Arroz Camarón + Lumpia)',
    description: 'Arroz frito especial con camarones salteados al wok + 1 lumpia y ricas salsas.',
    price: 8.50,
    cost: 3.20,
    category: 'plato',
    emoji: '🦐',
    active: true
  },
  {
    id: 'prod-pe01',
    name: 'Especial de la Casa (Ejecutivo)',
    description: 'Arroz blanco salteado con cebollín + vegetales salteados + chuleta ahumada + bebida gratis.',
    price: 6.90,
    cost: 2.40,
    category: 'plato',
    emoji: '🥩',
    active: true
  },
  {
    id: 'prod-pe02',
    name: 'Boloñesa Artesanal (Ejecutivo)',
    description: 'Receta exclusiva de carne seleccionada a fuego lento con tomates frescos, especies y hierbas + bebida gratis.',
    price: 5.00,
    cost: 1.80,
    category: 'plato',
    emoji: '🍝',
    active: true
  },
  {
    id: 'prod-pe03',
    name: 'Full Tentación (Ejecutivo)',
    description: 'Vermicellis salteados en salsa artesanal de tomates frescos con finas tiras de carne y albahaca + bebida gratis.',
    price: 8.00,
    cost: 2.90,
    category: 'plato',
    emoji: '🍅',
    active: true
  },
  {
    id: 'prod-pe04',
    name: 'Pasta con Camarones al Ajillo (Ejecutivo)',
    description: 'Vermicellis en cremosa salsa de ajo con camarones salteados al punto y hierbas frescas + bebida gratis.',
    price: 9.00,
    cost: 3.50,
    category: 'plato',
    emoji: '🧄',
    active: true
  },

  // --- ARROCES (KILOS & MEDIOS KILOS) --------------------------------------
  {
    id: 'prod-ar01',
    name: 'Full Kilo Especial (1 kg)',
    description: '1 kg arroz frito especial al wok con pollo, jamón, cerdo, camarón y secreto Full China.',
    price: 11.80,
    cost: 4.20,
    category: 'arroz',
    emoji: '🍚',
    active: true
  },
  {
    id: 'prod-ar02',
    name: 'Medio Kilo Especial (1/2 kg)',
    description: '1/2 kg arroz frito especial al wok con pollo, jamón, cerdo, camarón.',
    price: 7.00,
    cost: 2.50,
    category: 'arroz',
    emoji: '🍚',
    active: true
  },
  {
    id: 'prod-ar03',
    name: 'Arroz con Camarones y Pollo (1 kg)',
    description: '1 kg arroz frito especial al wok con pollo, camarón y toque secreto.',
    price: 9.90,
    cost: 3.60,
    category: 'arroz',
    emoji: '🦐',
    active: true
  },
  {
    id: 'prod-ar04',
    name: 'Arroz con Camarones y Pollo (1/2 kg)',
    description: '1/2 kg arroz frito especial al wok con pollo, camarón.',
    price: 6.00,
    cost: 2.20,
    category: 'arroz',
    emoji: '🦐',
    active: true
  },
  {
    id: 'prod-ar05',
    name: 'El Clásico (1 kg)',
    description: '1 kg arroz frito con jamón, pollo y huevo salteado al wok.',
    price: 9.90,
    cost: 3.20,
    category: 'arroz',
    emoji: '🍳',
    active: true
  },
  {
    id: 'prod-ar06',
    name: 'El Clásico (1/2 kg)',
    description: '1/2 kg arroz frito con jamón, pollo y huevo salteado al wok.',
    price: 6.00,
    cost: 1.90,
    category: 'arroz',
    emoji: '🍳',
    active: true
  },
  {
    id: 'prod-ar07',
    name: 'Full Kilo Cantonés (1 kg)',
    description: '1 kg arroz con full proteínas: carne, pollo, cerdo, jamón y CAMARONES + vegetales salteados.',
    price: 13.90,
    cost: 5.10,
    category: 'arroz',
    emoji: '👑',
    active: true
  },
  {
    id: 'prod-ar08',
    name: 'Medio Kilo Cantonés (1/2 kg)',
    description: '1/2 kg arroz cantonés con carne, pollo, cerdo, jamón y camarones + vegetales.',
    price: 9.00,
    cost: 3.30,
    category: 'arroz',
    emoji: '👑',
    active: true
  },

  // --- TALLARINES & CHOW MEIN & VERMICELLI ----------------------------------
  {
    id: 'prod-no01',
    name: 'Tallarines Especial',
    description: 'Tallarín full especial salteado al wok con ricas salsas + vegetales mixtos (pollo, carne, camarón).',
    price: 9.00,
    cost: 3.20,
    category: 'noodles',
    emoji: '🍜',
    active: true
  },
  {
    id: 'prod-no02',
    name: 'Tallarín Mixto',
    description: 'Tallarín salteado al wok con ricas salsas + vegetales mixtos (pollo y carne).',
    price: 8.00,
    cost: 2.80,
    category: 'noodles',
    emoji: '🍜',
    active: true
  },
  {
    id: 'prod-no03',
    name: 'Tallarín Veggie',
    description: 'Tallarín salteado al wok con brócoli, zanahoria, calabacín y cebolla.',
    price: 6.00,
    cost: 1.80,
    category: 'noodles',
    emoji: '🥬',
    active: true
  },
  {
    id: 'prod-no04',
    name: 'Tallarines / Vermicelli Camarón',
    description: 'Tallarín o vermicelli salteado al wok con ricas salsas y camarones.',
    price: 9.00,
    cost: 3.40,
    category: 'noodles',
    emoji: '🦐',
    active: true
  },
  {
    id: 'prod-no05',
    name: 'Vermicelli Mixto',
    description: 'Pasta vermicelli salteada al wok con salsas de la casa + vegetales (pollo y carne).',
    price: 7.00,
    cost: 2.50,
    category: 'noodles',
    emoji: '🥢',
    active: true
  },
  {
    id: 'prod-no06',
    name: 'Vermicelli Veggie',
    description: 'Pasta vermicelli salteada al wok con brócoli, zanahoria, calabacín y cebolla.',
    price: 5.00,
    cost: 1.50,
    category: 'noodles',
    emoji: '🥢',
    active: true
  },
  {
    id: 'prod-no07',
    name: 'Vermicelli Full (Especial)',
    description: 'Pasta vermicelli con vegetales salteados al wok con carne, pollo y camarón.',
    price: 9.00,
    cost: 3.30,
    category: 'noodles',
    emoji: '🔥',
    active: true
  },

  // --- WOK & SALTEADOS -----------------------------------------------------
  {
    id: 'prod-wk01',
    name: 'Chop Suey Veggie',
    description: 'Vegetales salteados al wok: zanahoria, repollo, pimentón y cebolla.',
    price: 5.00,
    cost: 1.40,
    category: 'wok',
    emoji: '🥗',
    active: true
  },
  {
    id: 'prod-wk02',
    name: 'Chop Suey Mixto',
    description: 'Vegetales salteados al wok con ricas proteínas de pollo y carne.',
    price: 6.50,
    cost: 2.30,
    category: 'wok',
    emoji: '🥗',
    active: true
  },
  {
    id: 'prod-wk03',
    name: 'Chop Suey Full',
    description: 'Vegetales salteados al wok con ricas proteínas de pollo, carne y CAMARONES.',
    price: 8.00,
    cost: 2.90,
    category: 'wok',
    emoji: '🦐',
    active: true
  },
  {
    id: 'prod-wk04',
    name: 'Camarones Salteados (200g)',
    description: '200g de camarón salteado al wok con ricas salsas y vegetales.',
    price: 9.00,
    cost: 3.50,
    category: 'wok',
    emoji: '🦐',
    active: true
  },
  {
    id: 'prod-wk05',
    name: 'Camarones Crispy (180g)',
    description: '180g de camarones al panco empanizados fritos crujientes con salsa.',
    price: 9.80,
    cost: 3.80,
    category: 'wok',
    emoji: '🍤',
    active: true
  },
  {
    id: 'prod-wk06',
    name: 'Lomito con Vegetales',
    description: 'Especialidad de la casa: Lomito con brócoli, pimentón, zanahoria, cebolla y calabacín al wok.',
    price: 10.00,
    cost: 3.90,
    category: 'wok',
    emoji: '🥩',
    active: true
  },

  // --- RACIONES & ENTRADAS --------------------------------------------------
  {
    id: 'prod-ra01',
    name: 'Teque-Teque (6 und)',
    description: '6 unidades de tequeños de queso crujientes.',
    price: 3.50,
    cost: 1.10,
    category: 'racion',
    emoji: '🧀',
    active: true
  },
  {
    id: 'prod-ra02',
    name: 'Lumpias Sencillas (2 und)',
    description: '2 unidades de lumpias crujientes rellenas de vegetales.',
    price: 3.50,
    cost: 0.90,
    category: 'racion',
    emoji: '🥟',
    active: true
  },
  {
    id: 'prod-ra03',
    name: 'Lumpias Especiales (2 und)',
    description: '2 unidades de lumpias crujientes de vegetales + 1 proteína a elegir (pollo, carne, jamón, camarón).',
    price: 5.00,
    cost: 1.60,
    category: 'racion',
    emoji: '🥟',
    active: true
  },
  {
    id: 'prod-ra04',
    name: 'Picadera Full',
    description: 'Plato variado con lumpias, papas fritas, costilla y media ración de pollo agridulce.',
    price: 9.00,
    cost: 3.40,
    category: 'racion',
    emoji: '🍱',
    active: true
  },
  {
    id: 'prod-ra05',
    name: 'Papas Fritas (200g)',
    description: '200g de papas fritas crujientes doradas.',
    price: 3.00,
    cost: 0.80,
    category: 'racion',
    emoji: '🍟',
    active: true
  },
  {
    id: 'prod-ra06',
    name: 'Nuggets (6 piezas + Papas)',
    description: '6 piezas de nuggets de pollo El Corral + papas fritas.',
    price: 6.00,
    cost: 2.10,
    category: 'racion',
    emoji: '🍗',
    active: true
  },
  {
    id: 'prod-ra07',
    name: 'Pollo Agridulce (8 piezas)',
    description: '8 piezas de pechuga de pollo al estilo Full China en salsa agridulce.',
    price: 6.00,
    cost: 2.20,
    category: 'racion',
    emoji: '🐥',
    active: true
  },
  {
    id: 'prod-ra08',
    name: 'Costilla Agridulce (2 und)',
    description: '2 unidades de costillas marinadas al horno salteadas al wok y bañadas en salsa agridulce.',
    price: 6.00,
    cost: 2.30,
    category: 'racion',
    emoji: '🍖',
    active: true
  },
  {
    id: 'prod-ra09',
    name: 'Costilla Agridulce (4 und)',
    description: '4 unidades de costillas marinadas al horno salteadas al wok y bañadas en salsa agridulce.',
    price: 12.00,
    cost: 4.50,
    category: 'racion',
    emoji: '🍖',
    active: true
  },
  {
    id: 'prod-ra10',
    name: 'Costilla Sal y Pimienta (2 und)',
    description: '2 unidades de costillas marinadas picantes salteadas con sal y pimienta.',
    price: 6.00,
    cost: 2.30,
    category: 'racion',
    emoji: '🌶️',
    active: true
  },
  {
    id: 'prod-ra11',
    name: 'Costilla Sal y Pimienta (4 und)',
    description: '4 unidades de costillas marinadas picantes salteadas con sal y pimienta.',
    price: 12.00,
    cost: 4.50,
    category: 'racion',
    emoji: '🌶️',
    active: true
  },

  // --- EXTRAS & BEBIDAS -----------------------------------------------------
  {
    id: 'prod-ex01',
    name: 'Extra Camarón',
    description: 'Adicional de camarón salteado al wok.',
    price: 3.00,
    cost: 1.20,
    category: 'extra',
    emoji: '🦐',
    active: true
  },
  {
    id: 'prod-ex02',
    name: 'Extra Pollo / Jamón / Cerdo',
    description: 'Adicional de proteína salteada al wok.',
    price: 2.00,
    cost: 0.80,
    category: 'extra',
    emoji: '🥩',
    active: true
  },
  {
    id: 'prod-ex03',
    name: 'Refresco 1 Litro',
    description: 'Refresco de botella 1 Litro (Pepsi / Seven Up / Colita).',
    price: 2.50,
    cost: 1.00,
    category: 'extra',
    emoji: '🥤',
    active: true
  },
  {
    id: 'prod-ex04',
    name: 'Refresco Personal 500ml',
    description: 'Refresco personal helado.',
    price: 1.50,
    cost: 0.50,
    category: 'extra',
    emoji: '🥤',
    active: true
  },
  {
    id: 'prod-ex05',
    name: 'Agua Mineral 500ml',
    description: 'Botella de agua mineral helada.',
    price: 1.00,
    cost: 0.30,
    category: 'extra',
    emoji: '💧',
    active: true
  }
]
