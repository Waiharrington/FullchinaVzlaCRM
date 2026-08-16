# Fase 2 — Capturar modificadores en la comanda y cerrar el consumo de inventario

## Problema

El trigger de consumo de inventario aplicado el 2026-08-16
(`20260816000000_consume_recipe_stock_on_sale.sql`) descuenta ingredientes a partir de
`recipe_components`. Pero parte del consumo real está definido en el modelo de
**modificadores** importado de INVU (`modifier_option_ingredients`), y ese consumo **no se
descuenta** porque la comanda **no registra qué opciones de modificador se eligieron por línea**.

### Dimensión del hueco (medido en el VPS, 2026-08-16)

- 81 productos activos; 18 tienen modificadores; **solo 6 activos** los usan.
- De esos 6, solo **2 activos** tienen ingredientes vía modificador:
  - **`Almuerzo o Cena`** ($0.01) — 0 en receta, **6 vía modificador**. Su consumo vive
    100% en el modificador "Comida" (elige 1 de 6: Arroz, Camarón, Cerdo, Jamón, Pasta,
    Pollo; cada opción define su ingrediente). **Es el caso crítico.**
  - **`Trio`** ($7.00) — 11 en receta, 1 vía modificador (impacto menor).
- Los otros 12 productos con modificadores están **inactivos** (parents de INVU a $0.00 que
  Caja no lista); su consumo no aplica mientras no se vendan directamente.
- Solo **1 ingrediente** en todo el sistema es alcanzable únicamente por modificador (el
  resto se comparte con recetas) → el maestro de ingredientes ya está casi todo cubierto.
- **0 ventas** de productos con modificador en la app nueva todavía → migrar ahora no
  requiere backfill de histórico vivo.

**Conclusión:** el hueco es pequeño y concentrado, pero comercialmente relevante: el combo
de almuerzo/cena suele ser de lo más vendido. Cerrarlo bien deja el inventario correcto.

---

## Diseño

Principio rector: **no tocar la maquinaria de totales y pagos**, que en todo el sistema
calcula `SUM(order_items.quantity * order_items.unit_price)` (RPC de pago, derivación de
estado, vistas, desglose de caja). Por eso el precio de los modificadores se **sella dentro
de `order_items.unit_price`** (precio efectivo), y los modificadores se guardan aparte solo
como detalle/auditoría y **driver de consumo**.

### 1. Modelo de datos — nueva tabla `order_item_modifiers`

```sql
CREATE TABLE fullchinavzla.order_item_modifiers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id      UUID NOT NULL REFERENCES fullchinavzla.order_items(id) ON DELETE CASCADE,
  modifier_option_id UUID NOT NULL REFERENCES fullchinavzla.modifier_options(id),
  quantity           NUMERIC(12,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0), -- precio de la opción sellado al vender
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_oim_order_item ON fullchinavzla.order_item_modifiers(order_item_id);
CREATE INDEX idx_oim_option ON fullchinavzla.order_item_modifiers(modifier_option_id);
```

Registra, por cada renglón de la orden, qué opciones se eligieron y en qué cantidad.

### 2. Precio — efectivo sellado en el servidor (anti-manipulación)

`order_items.unit_price` = precio base del producto **+** Σ (precio de opciones elegidas ×
su cantidad). El cliente envía solo los `modifier_option_id` y cantidades; el servidor busca
`modifier_options.sale_price` en el catálogo (igual que hoy con el precio del producto). Así:

- Los totales, cobertura de pago, estado `paid`, vistas y caja **siguen intactos**.
- No se puede manipular el precio desde el navegador.
- Para `Almuerzo o Cena` (opciones a $0.00) el precio efectivo = $0.01 base; para combos
  donde la opción sí tiene precio, se suma correctamente.

`order_item_modifiers.unit_price` guarda además el precio de cada opción por separado para
el recibo y los reportes de desglose.

### 3. Consumo — nuevo trigger `AFTER INSERT ON order_item_modifiers`

Análogo al de recetas. Por cada opción registrada, descuenta sus
`modifier_option_ingredients` (normalizados a unidad base × cantidad de la opción × cantidad
del renglón), como movimientos `consumption` / `reference_type='order_item'` /
`reference_id = order_item_id`.

```sql
-- pseudo-cuerpo
FOR moi IN
  SELECT * FROM modifier_option_ingredients
  WHERE modifier_option_id = NEW.modifier_option_id
    AND (order_type_code IS NULL OR order_type_code = '' OR order_type_code = <order.order_type>)
LOOP
  v_norm := normalize_to_base_unit(moi.ingredient_id,
              moi.quantity * NEW.quantity * <order_item.quantity>, moi.unit_id);
  INSERT INTO stock_movements(ingredient_id, -v_norm, base_unit, 'consumption',
              'order_item', NEW.order_item_id, 'Consumo por modificador', order.created_by);
END LOOP;
```

**La reversa por cancelación NO necesita cambios:** `fn_reverse_recipe_stock_on_cancel` ya
revierte *todos* los movimientos `consumption` con `reference_type='order_item'` de la orden,
sin importar si vinieron de receta o de modificador. Queda cubierta gratis.

`order_type_code` se respeta si algún día se usa (hoy está vacío en las 158 filas).

### 4. Checkout — extender `fn_checkout_order`

- `p_items` pasa a llevar, por ítem, un arreglo opcional `modifiers: [{ optionId, quantity }]`.
- El RPC, tras insertar cada `order_items` (con `unit_price` = base + opciones, calculado del
  catálogo), inserta las filas de `order_item_modifiers` con el `sale_price` sellado.
- Validación server-side de reglas del modificador (min/max/allow_repeat) para no confiar en
  el cliente. El mismo cambio aplica a la ruta `sendToKitchen` (comanda sin pago).

### 5. Frontend — Caja / Comandas

- Al agregar al carrito un producto con modificadores (`sellable_product_modifiers`), abrir
  un selector con los grupos (`modifiers`) y sus opciones (`modifier_options`), respetando
  `min_selections`, `max_selections` y `allow_repeat`.
- El ítem del carrito gana `selectedModifiers: [{ optionId, name, price, quantity }]` y su
  precio de línea = base + Σ opciones.
- En el cobro/envío se mandan los `optionId` + cantidades. `dataService.checkout` /
  `sendToKitchen` los reenvían al RPC.
- Recibo y detalle de comanda muestran las opciones elegidas bajo cada producto.

### 6. RLS

`order_item_modifiers` replica las políticas de `order_items`: `authenticated` puede
insertar/leer según su rol; escritura efectiva ocurre dentro del RPC `SECURITY DEFINER`, así
que el cajero no necesita INSERT directo.

---

## Plan de aplicación por fases (con la misma disciplina que la Fase 1)

1. **Migración A (aditiva, sin riesgo):** crear `order_item_modifiers` + RLS + el trigger de
   consumo de modificadores. No afecta ventas existentes (nadie inserta en la tabla aún).
2. **Migración B (checkout):** reemplazar `fn_checkout_order` (y la inserción de items de
   `sendToKitchen`) para aceptar y persistir modificadores y sellar el precio efectivo.
   Es la parte sensible (toca el cobro en vivo) → **backup + dry-run con ROLLBACK** probando
   una venta de `Almuerzo o Cena` con opción "Pollo" y verificando el movimiento de consumo.
3. **Frontend:** selector de modificadores en Caja/Comandas + modelo de carrito + recibo.
4. **Verificación:** vender `Almuerzo o Cena` real y ver el ingrediente bajar en Inventario.

## Riesgos y mitigaciones

- **Cobro en vivo:** cambiar `fn_checkout_order` puede romper la caja si falla. Mitigación:
  dry-run en transacción revertida contra el esquema real antes del COMMIT (ya probado en
  Fase 1).
- **Precio $0.01 de parents:** confirmar con el negocio el precio real del combo antes de
  vender por la app (hoy el precio efectivo saldría $0.01). Puede requerir ajustar
  `sellable_products.price` o los `modifier_options.sale_price`.
- **Doble conteo:** los ingredientes por modificador y por receta se descuentan por caminos
  distintos; verificar que un producto no liste el mismo ingrediente en ambos para el mismo
  consumo (en los datos actuales `Trio` es el único con ambos; revisar sus 11 de receta + 1
  de modificador).
