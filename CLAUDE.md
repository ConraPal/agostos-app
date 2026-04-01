# Agostos — Gestión de Campo

App web de gestión de campo construida con tecnologías vanilla, sin frameworks ni dependencias externas.

## Stack

- **HTML5** — estructura semántica, un `index.html` por ahora (SPA sin build step)
- **CSS3** — variables CSS, sin preprocesador ni utilidades externas
- **JavaScript vanilla (ES6+)** — módulos como IIFEs, sin bundler
- **Supabase** — backend principal (tabla `app_data`); `localStorage` como fallback automático
- **PWA** — `manifest.json` + `sw.js` (Service Worker cache-first), instalable en mobile y desktop

## Configuración Claude Code

`.claude/settings.json` — modo de permisos `acceptEdits`: Edit y Bash corren sin confirmación manual.

## Arquitectura

### Estructura de carpetas

```
agostos-app/
├── index.html              # Entry point único — contiene sidebar, topbar y todos los módulos
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker — cache-first, assets locales
├── css/
│   ├── main.css            # Estilos globales: layout, sidebar, bottom-nav, tablas, modales, formularios, toast, confirm
│   ├── livestock.css       # Estilos del módulo ganadería
│   ├── finance.css         # Estilos del módulo finanzas (incl. cotizacion-bar)
│   ├── fields.css          # Estilos del módulo potreros
│   ├── agricultura.css     # Estilos del módulo agricultura (badges cultivos/forraje)
│   ├── reports.css         # Estilos del módulo reportes (incl. export-card-actions)
│   └── print.css           # Estilos de impresión — oculta UI, muestra #print-view
├── js/
│   ├── storage.js          # Supabase + localStorage fallback — se carga primero
│   ├── livestock.js        # Módulo ganadería — se carga segundo
│   ├── finance.js          # Módulo finanzas — se carga tercero
│   ├── fields.js           # Módulo potreros — se carga cuarto
│   ├── agricultura.js      # Módulo agricultura (cultivos + forraje) — se carga quinto
│   ├── reports.js          # Módulo reportes — se carga sexto
│   └── app.js              # Bootstrap + ui.toast() + ui.confirm() + ui.pagination() + SW — se carga último
└── assets/
    ├── icons/
    │   ├── icon-192.svg    # Ícono PWA 192×192 (SVG verde, letra "A")
    │   └── icon-512.svg    # Ícono PWA 512×512
    ├── vaca-sidebar.jpg    # Imagen decorativa al pie del sidebar
    └── campo-bg.jpg        # Fondo general de la app
```

### Convenciones de módulos

Cada módulo sigue este patrón:

- **HTML**: sección `<section id="module-{nombre}">` en `index.html`
- **CSS**: archivo propio en `css/{nombre}.css`
- **JS**: IIFE exportada como `const NombreModulo = (() => { ... return { init, ... }; })();`
- El módulo expone siempre un método `init()` que registra listeners y hace el primer render
- **Keys de Storage**: prefijo `ag_` para evitar colisiones (ej: `ag_animals`, `ag_movements`)

### Patrón save + toast (crítico)

`closeModal()` pone `editingId = null`. Siempre capturar el estado de edición **antes** de llamar al close:

```js
// CORRECTO
const wasEditing = !!editingId;
closeModal();
ui.toast(wasEditing ? 'Actualizado.' : 'Registrado.');

// MAL — editingId ya es null cuando se evalúa
closeModal();
ui.toast(editingId ? 'Actualizado.' : 'Registrado.');
```

Este patrón aplica a todos los módulos: `saveAnimal`, `saveRepro`, `saveAmort`, `savePresupuesto`, `saveSanidad`, `saveCultivo`, `saveForraje`, `saveTransaction`.

### Home screen (post-login)

Al hacer login, el módulo activo por defecto es `#module-home` — una pantalla de bienvenida con tres tarjetas grandes:

| Tarjeta | `data-navigate` | Descripción |
|---------|----------------|-------------|
| 🐄 Ganadería | `livestock` | Stock, sanidad, movimientos y reproducción |
| 🌾 Agricultura | `agricultura` | Cultivos y forraje por potrero |
| 🗺️ Potreros | `fields` | Gestión de campos y hectáreas |

- `#module-home` no aparece en sidebar ni bottom-nav
- CSS en `main.css` bajo `/* ===== Home screen =====*/`: `.home-welcome`, `.home-card`, `.home-card-icon/label/desc`
- Dark mode: glassmorphism con `rgba(255,255,255,0.07)` + borde semitransparente

### Routing

No hay router de URL. La navegación entre módulos es visual (mostrar/ocultar secciones `.module`). El sidebar maneja el estado activo con clases CSS.

Al cambiar de módulo, `app.js` llama `navigateTo(mod)` — función centralizada que: actualiza `.active` en nav-items y módulos, actualiza el título del topbar, llama `refresh()` del módulo si aplica, y alterna la visibilidad de los botones de acción del topbar.

Los botones `.home-card[data-navigate]` también llaman `navigateTo(mod)` al hacer click.

### Mobile / Responsive

Breakpoints implementados en `main.css` y `livestock.css`:

| Breakpoint | Cambios |
|------------|---------|
| `≤ 768px`  | Sidebar oculto; aparece **bottom navigation bar** fija con los 5 módulos |
| `≤ 768px`  | Stats grid pasa de 4 → 2 columnas; form-row pasa a 1 columna |
| `≤ 768px`  | FAB y toast reposicionados encima de la bottom nav |
| `≤ 480px`  | Stats grid pasa a 1 columna; topbar más compacto |

**Bottom navigation (mobile):** `<nav class="bottom-nav">` en `index.html`, `position: fixed; bottom: 0`. Contiene 5 ítems con clase `nav-item bottom-nav-item` y `data-module` — el JS de `app.js` los maneja igual que los ítems del sidebar. La variable CSS `--bottom-nav-h: 58px` controla la altura y se usa para elevar el FAB, toast y el padding inferior de `.module`.

**Variable CSS clave:** `--bottom-nav-h: 58px` definida en `:root`. Todos los elementos que deben quedar por encima de la bottom nav la referencian con `calc(var(--bottom-nav-h) + env(safe-area-inset-bottom, 0px) + Npx)`.

### Orden de carga de scripts

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<script src="js/storage.js"></script>     <!-- 1. utilidades base -->
<script src="js/livestock.js"></script>   <!-- 2. módulos -->
<script src="js/finance.js"></script>     <!-- 3. módulos -->
<script src="js/fields.js"></script>      <!-- 4. módulos -->
<script src="js/agricultura.js"></script> <!-- 5. módulos -->
<script src="js/reports.js"></script>     <!-- 6. módulos -->
<script src="js/app.js"></script>         <!-- 7. bootstrap -->
```

### Tabs

Los tabs están scoped al módulo padre: el handler en `app.js` usa `.closest('.module')` para activar/desactivar solo los tabs y tab-contents del módulo actualmente visible.

**Diseño visual (pill-buttons):** `.tabs` es un contenedor con fondo propio, borde y `border-radius: 12px`. Cada `.tab` es un pill button; el activo tiene `background: var(--color-primary)` + texto blanco + sombra verde. Hover muestra fondo de superficie + borde sutil. Dark mode: contenedor `background: #111`.

---

## Módulo: Ganadería (Livestock)

### Propósito

Registro, seguimiento y gestión del stock de animales del campo.

### Datos persistidos

| Key               | Contenido                            |
|-------------------|--------------------------------------|
| `ag_animals`      | Array de animales registrados        |
| `ag_movements`    | Array de movimientos entre potreros  |
| `ag_history`      | Log automático de eventos por animal |
| `ag_reproduction` | Array de ciclos reproductivos        |
| `ag_sanidad`      | Array de eventos sanitarios          |

### Estructura de un animal

```js
{
  id:               String,   // timestamp como string
  caravana:         String,   // identificador único, ej: "AR-0042"
  nombre:           String,
  tipo:             String,   // "vaca" | "toro" | "ternero" | "vaquillona" | "novillo"
  raza:             String,
  nacimiento:       String,   // ISO date
  potrero:          String,
  estado:           String,   // "activo" | "vendido" | "muerto"
  peso:             Number,   // kg
  castracion_fecha: String,   // ISO date — solo para terneros; null si no aplica
  observaciones:    String
}
```

- `#row-castracion` en el modal se muestra/oculta según el tipo seleccionado (solo visible para `ternero`).
- En la tabla se muestra "Castrado" como subtexto cuando `castracion_fecha` existe.

### Estructura de un movimiento

```js
{
  id:            String,   // timestamp como string
  timestamp:     String,   // ISO datetime de creación
  fecha:         String,   // ISO date elegida por el usuario
  animalId:      String,
  caravana:      String,
  animalNombre:  String,
  tipo:          String,   // "traslado" | "entrada" | "salida"
  origen:        String,
  destino:       String,
  observaciones: String
}
```

### Estructura de una entrada de historial

```js
{
  id:       Number,   // Date.now()
  fecha:    String,   // ISO datetime
  caravana: String,
  nombre:   String,
  evento:   String,   // "Alta" | "Actualización" | "Baja" | "Movimiento" | "Sanidad"
  detalle:  String
}
```

### Estructura de un ciclo reproductivo

```js
{
  id:                       String,
  año:                      Number,
  fecha_entrada_toros:      String,   // ISO date
  fecha_salida_toros:       String,
  tacto_fecha:              String,
  vacas_total:              Number,
  vacas_positivas:          Number,
  vacas_negativas:          Number,   // calculado
  prenez_pct:               Number,   // calculado
  ia_realizada:             Boolean,
  ia_fecha:                 String,
  ia_toro:                  String,
  ia_prenez_pct:            Number,
  paricion_inicio:          String,
  paricion_fin:             String,
  partos:                   Number,
  muertes_paricion:         Number,
  destete_fecha:            String,
  terneros_machos_destete:  Number,
  terneras_hembras_destete: Number,
  muertes_destete:          Number,
  indice_destete:           Number,   // calculado
  mortalidad_total:         Number,   // calculado
  observaciones:            String
}
```

**Índices clave:**
- **Índice de preñez** = vacas_positivas / vacas_total × 100
- **Índice de destete** = (machos + hembras) / partos × 100
- **Mortalidad total** = muertes_paricion + muertes_destete

### Estructura de un evento sanitario

```js
{
  id:            String,
  fecha:         String,   // ISO date
  animalId:      String,   // null si aplica al rodeo completo
  caravana:      String,   // '' si rodeo completo
  animalNombre:  String,
  tipo:          String,   // "vacunación" | "desparasitación" | "veterinario" | "otro"
  descripcion:   String,
  producto:      String,
  dosis:         String,
  observaciones: String
}
```

### Badge tokens de sanidad (CSS)

| Clase | Color | Tipo |
|-------|-------|------|
| `.badge-sanidad-vacunacion` | Verde | vacunación |
| `.badge-sanidad-desparasitacion` | Azul | desparasitación |
| `.badge-sanidad-veterinario` | Naranja | veterinario |
| `.badge-sanidad-otro` | Gris | otro |
| `.badge-evento-sanidad` | Violeta | en historial |

### `logHistory(caravana, evento, detalle, nombre = '')`

Función interna. Llamada desde los 5 puntos de escritura:

| Caller | Evento | Detalle |
|--------|--------|---------|
| `saveAnimal` | `Alta` | `Tipo: {tipo}` |
| `saveAnimal` | `Actualización` | `Datos editados` |
| `remove` | `Baja` | `Eliminado del registro` |
| `saveMovement` | `Movimiento` | `{tipo} de {origen} a {destino}` |
| `saveSanidad` | `Sanidad` | `{tipo}: {descripcion}` |

### Tabs del módulo

- **Registro** — CRUD completo, stats en tiempo real, búsqueda por caravana/nombre, filtro por tipo, sort por Tipo y Peso ✓
- **Movimientos** — registro de traslados/entradas/salidas, dropdown de búsqueda de animal ✓
- **Historial** — log cronológico con badges por tipo de evento ✓
- **Reproducción** — ciclo completo: servicio, tacto, IA, parición, destete; filtro por año ✓
- **Sanidad** — CRUD de vacunaciones, desparasitaciones, atenciones veterinarias; campo animal opcional (rodeo completo) ✓

---

## Módulo: Finanzas

### Propósito

Registro de ingresos y gastos del campo, con soporte bimonetario ARS/USD, resumen por categoría, presupuesto, amortizaciones y cálculo de margen.

### Datos persistidos

| Key                | Contenido                           |
|--------------------|-------------------------------------|
| `ag_transactions`  | Array de transacciones              |
| `ag_amortizations` | Array de activos amortizables       |
| `ag_presupuesto`   | Array de ítems de presupuesto       |
| `ag_cotizacion`    | `{ usd_ars: Number, fecha: String }` |

### Estructura de una transacción

```js
{
  id:             String,   // timestamp como string
  fecha:          String,   // ISO date
  tipo:           String,   // "ingreso" | "gasto" | "impuesto"
  categoria:      String,
  monto:          Number,
  moneda:         String,   // "ARS" (default) | "USD" — backward compatible
  descripcion:    String,
  observaciones:  String,
  potrero:        String,   // opcional — para gastos por potrero
  // Campos opcionales para ventas (auto-calculan monto)
  cantidad:       Number,
  precio_unitario:Number,
  peso_kg:        Number,
  precio_kg:      Number
}
```

### Estructura de una amortización

```js
{
  id:             String,
  nombre:         String,
  tipo:           String,   // "Maquinaria" | "Instalaciones" | "Rodado" | "Otro"
  valor_original: Number,
  vida_util:      Number,   // años
  año_inicio:     Number,
  cuota_anual:    Number,   // calculado: valor_original / vida_util
  observaciones:  String
}
```

### Estructura de un ítem de presupuesto

```js
{
  id:       String,
  año:      Number,
  tipo:     String,   // "ingreso" | "gasto"
  categoria:String,
  monto:    Number
}
```
Un ítem por año+tipo+categoría (se valida duplicado al crear).

### Bimonetario ARS / USD

- `toARS(monto, moneda)` — convierte USD → ARS usando `ag_cotizacion.usd_ars`; las transacciones sin `moneda` se tratan como ARS
- `fmtMoneda(monto, moneda)` — prefijo `$` (ARS) o `USD` (USD)
- `renderStats()` — separa totales por moneda: `stat-ingresos-ars` / `stat-ingresos-usd` / `stat-gastos-ars` / `stat-gastos-usd`; el USD sub-stat solo se muestra si hay transacciones en USD. Balance usa ARS equiv. (label "ARS equiv." en el stat card)
- `renderResumen()` — acumula `{ ars, usd }` por categoría; muestra ambos cuando coexisten, con `.badge-moneda-usd` para el monto USD
- `renderMargen()` — usa `toARS()` en todos los cálculos (ingresos, costos, impuestos)
- En la tabla de transacciones, gastos e impuestos se muestran con prefijo `−` (signo menos)
- Barra de cotización `#cotizacion-bar` en el tab Transacciones: input de valor + botón Guardar
- Clases CSS nuevas en `finance.css`: `.stat-sub-moneda`, `.badge-moneda-usd`, `.resumen-sep`, `.resumen-monto`, `.stat-label-note`

### Categorías

**Ingreso:** Toros · Vacas vacías · Terneros machos · Terneras hembras · Novillos · Vaquillonas · Cereales · Arrendamiento · Subsidios · Otro ingreso

**Gasto:** Personal · Vacunas · Semillas · Agroquímicos · Labranzas · Cosechas · Almacenamiento · Enfardados · Gastos veterinarios · Reparaciones maquinaria · Reparaciones generales · Aplicaciones agroquímicos · Varios · Combustibles · Electricidad · Materiales y herramientas

**Impuesto/Retención:** Ganancias · Impuesto inmobiliario · Tasas municipales · Patentes · Seguros

**Campos opcionales en ventas:**
- Por peso (Terneros, Novillos, Vaquillonas): `peso_kg` + `precio_kg` → auto-calcula `monto`
- Por cabeza (Toros, Vacas vacías, Cereales): `cantidad` + `precio_unitario` → auto-calcula `monto`

### Stats

- **Balance** — (Σ ingresos ARS + USD→ARS) − (Σ gastos ARS + USD→ARS); rojo si negativo; label "ARS equiv."
- **Total ingresos** — `stat-ingresos-ars` (ARS) + `stat-ingresos-usd` (USD, oculto si cero)
- **Total gastos** — `stat-gastos-ars` (ARS) + `stat-gastos-usd` (USD, oculto si cero)
- **Transacciones del mes** — count del mes en curso

### Tabs del módulo

- **Transacciones** — CRUD con búsqueda, filtro por tipo, selector de moneda, barra de cotización USD ✓
- **Resumen** — totales por categoría (ingresos / gastos) + gastos por potrero ✓
- **Amortizaciones** — CRUD de activos; stats de total activos y cuota anual total ✓
- **Margen** — filtro por año; fórmula: Ingresos − Costos − Amortizaciones = Margen Bruto − Impuestos = Margen Neto ✓
- **Presupuesto** — comparación presupuestado vs real por categoría y año; filtro por año ✓

---

## Módulo: Potreros

### Propósito

Gestión de campos y pasturas del establecimiento, con visibilidad de stock por potrero.

### Datos persistidos

| Key        | Contenido       |
|------------|-----------------|
| `ag_fields`| Array de potreros|

### Estructura de un potrero

```js
{
  id:            String,
  nombre:        String,
  hectareas:     Number,
  pastura:       String,   // "Natural" | "Mejorada" | "Verdeo" | "Otro"
  estado:        String,   // "activo" | "descanso" | "clausurado"
  observaciones: String
}
```

### Stats

- **Total potreros** / **Total hectáreas** / **En uso** (con ≥1 animal activo) / **Libres**

### Tabs del módulo

- **Potreros** — CRUD con búsqueda por nombre/pastura, badges de estado ✓
- **Stock** — tabla que cruza `ag_animals` activos con potreros; potreros con animales no registrados aparecen como "sin registrar" ✓

### Notas de integración

- `Fields.refresh()` es llamado desde `app.js` al navegar al módulo.
- El campo `potrero` de los animales es texto libre; el cruce se hace por coincidencia exacta de nombre.
- Botón `+ Nuevo potrero` inline dentro del tab (id: `btn-new-field-inline`), adicional al del topbar (`btn-new-field`). Ambos llaman `openModal()` en `fields.js`.

---

## Módulo: Agricultura

### Propósito

Historial de cultivos y registro de forraje (rollos y fardos) por potrero.

### Datos persistidos

| Key               | Contenido                      |
|-------------------|--------------------------------|
| `ag_crop_history` | Array de registros de cultivos |
| `ag_forraje`      | Array de registros de forraje  |

### Estructura de un registro de cultivo

```js
{
  id:         String,
  potrero_id: String,
  potrero:    String,   // nombre desnormalizado
  año:        Number,
  tipo:       String,   // "cultivo" | "pastura"
  detalle:    String,
  notas:      String
}
```

### Estructura de un registro de forraje

```js
{
  id:            String,
  potrero_id:    String,
  potrero:       String,
  año:           Number,
  tipo:          String,   // "rollo" | "fardo"
  cantidad:      Number,
  cortes:        Number,
  observaciones: String
}
```

### Stats

| Stat ID | Label | Cálculo |
|---------|-------|---------|
| `stat-agro-cultivos` | Cultivos registrados | `ag_crop_history.length` |
| `stat-agro-rollos` | Total rollos | Σ `ag_forraje` tipo `rollo` |
| `stat-agro-fardos` | Total fardos | Σ `ag_forraje` tipo `fardo` |
| `stat-agro-potreros` | Potreros con cultivo | potreros únicos en `ag_crop_history` |

### Tabs del módulo

- **Cultivos** — CRUD con filtro por potrero y año; badges `.badge-cultivo-cultivo` (verde) / `.badge-cultivo-pastura` (azul) ✓
- **Forraje** — CRUD; badges `.badge-forraje-rollo` (naranja) / `.badge-forraje-fardo` (rosa) ✓

### Botones de acción en topbar

- `btn-new-cultivo` — primario, visible solo con Agricultura activo
- `btn-new-forraje` — secundario, visible solo con Agricultura activo

---

## Módulo: Reportes

### Propósito

Resúmenes cruzados entre módulos, gráficos, exportación CSV/JSON, impresión y compartir.

### Tabs del módulo

- **Ganadería** — stock activo por tipo y por potrero, con %, gráfico doughnut ✓
- **Finanzas** — balance mensual del año en curso, gráfico de barras ingresos vs gastos ✓
- **Reproducción** — ciclos por año con índices, gráfico de barras preñez/destete ✓
- **Forraje** — totales de rollos y fardos + desglose por potrero ✓
- **Exportar** — CSV de animales/movimientos/transacciones/potreros/sanidad/reproducción; importar CSV animales; backup/restore JSON; imprimir PDF; compartir por WhatsApp ✓

### Gráficos (Chart.js v4)

| Variable | Tipo | Tab |
|----------|------|-----|
| `_chartHacienda` | doughnut | Ganadería |
| `_chartFinanzas` | bar | Finanzas |
| `_chartRepro` | bar | Reproducción |

Destroy + recreate en cada `refresh()`.

### Imprimir / PDF

- `printView(titulo, html)` — inyecta en `#print-view` y llama `window.print()`
- `printRodeo()` — stock activo por tipo y potrero
- `printMovimientos()` — movimientos del mes actual
- `printTransacciones()` — transacciones del año en curso
- `#print-view` en `index.html` — oculto normalmente, visible con `@media print` desde `print.css`

### Compartir por WhatsApp

- `shareReport(titulo, texto)` — usa `navigator.share` en mobile; fallback `wa.me/?text=` en desktop
- `shareRodeo()`, `shareMovimientos()`, `shareTransacciones()` — texto plano para compartir

### CSV export

| Función | Archivo |
|---------|---------|
| `exportAnimals()` | `animales.csv` |
| `exportMovements()` | `movimientos.csv` |
| `exportTransactions()` | `transacciones.csv` |
| `exportFields()` | `potreros.csv` |
| `exportSanidad()` | `sanidad.csv` |
| `exportReproduccion()` | `reproduccion.csv` |

### Backup / Restore

- `exportBackup()` — JSON con todas las keys + `_version` + `_date`
- `importBackup(file)` — restaura desde JSON; requiere recargar la página
- `ALL_KEYS` incluye: `ag_animals`, `ag_movements`, `ag_history`, `ag_reproduction`, `ag_sanidad`, `ag_transactions`, `ag_amortizations`, `ag_presupuesto`, `ag_cotizacion`, `ag_fields`, `ag_crop_history`, `ag_forraje`, `ag_alertas`

---

## UI Utilities (`app.js`)

### `ui.toast(msg, type?)`

Notificación flotante en esquina inferior derecha. `type`: `'success'` (default) o `'error'`. Se desvanece a los 2.8s.

### `ui.confirm(msg, okLabel?)`

Modal de confirmación. Devuelve Promise que resuelve `true` / `false`. Reemplaza `confirm()` nativo.

### `ui.pagination(containerId, total, page, pageSize, onPageChange)`

Renderiza controles de paginación. Si `totalPages <= 1`, vacía el contenedor.

**Tablas paginadas (PAGE\_SIZE = 20):**

| Tabla | containerId | Estado de página | Módulo |
|-------|-------------|------------------|--------|
| Animales | `animals-pagination` | `animalsPage` | livestock.js |
| Movimientos | `movements-pagination` | `movementsPage` | livestock.js |
| Historial | `history-pagination` | `historyPage` | livestock.js |
| Sanidad | `sanidad-pagination` | `sanidadPage` | livestock.js |
| Transacciones | `transactions-pagination` | `transactionsPage` | finance.js |
| Amortizaciones | `amort-pagination` | `amortPage` | finance.js |
| Cultivos | `cultivos-pagination` | `cultivosPage` | agricultura.js |
| Forraje | `forraje-pagination` | `forrajePage` | agricultura.js |

Al cambiar filtro o búsqueda, el módulo resetea la página a 1.

### `ui.debounce(fn, ms = 300)`

Versión con debounce de `fn`. Usado en inputs de búsqueda.

---

## Storage (`storage.js`)

IIFE con métodos públicos: `init()`, `login()`, `logout()`, `getUser()`, `get()`, `set()`, `remove()`.

### Flujo de `init()` (async)

1. Crea el cliente Supabase y verifica sesión con `sb.auth.getUser()`
2. Sin sesión → `{ needsAuth: true }` (app muestra login screen)
3. Con sesión → `_loadUserData()`: carga filas filtradas por `user_id`
4. `app_data` vacío para el usuario → migra desde `localStorage` (one-time)
5. Fallo Supabase → modo fallback, opera desde `localStorage`

### `set(key, value)`

Actualiza cache inmediatamente → upsert Supabase fire-and-forget (o `localStorage` en fallback). Error de upsert → toast al usuario.

### Keys especiales

- **LOCAL\_ONLY** (nunca van a Supabase): `ag_dark_mode`
- **DATA\_KEYS** (migradas de localStorage): todas las `ag_*` excepto `ag_dark_mode`

---

## Integración entre módulos

- El campo **Potrero** en el modal de animales usa `<datalist id="potrero-options">` poblado desde `ag_fields` activos al abrir el modal.
- El campo **Destino** en el modal de movimientos usa `<datalist id="destino-options">` con la misma fuente.
- Al guardar un movimiento con destino no registrado en `ag_fields`, se ofrece registrarlo vía `ui.confirm()`.
- El campo **Potrero** en el modal de transacciones usa `<datalist id="tx-potrero-options">`.
- `Fields.refresh()`, `Agricultura.refresh()` y `Reports.refresh()` son llamados desde `app.js` al navegar a cada módulo.

---

## PWA

- **`manifest.json`** — `name: Agostos`, `start_url: /agostos-app/`, `display: standalone`, `theme_color: #2d6a4f`
- **`sw.js`** — estrategia cache-first; cachea todos los assets locales; excluye CDN cross-origin (Supabase, Chart.js); limpia cachés anteriores en `activate`
- **Registro** — `navigator.serviceWorker.register('sw.js')` en `app.js` al final del script (fuera del DOMContentLoaded)
- **Meta tags** — `theme-color`, `apple-mobile-web-app-capable`, `apple-touch-icon`, favicon SVG

---

## Dark mode

- Botón `#btn-dark-toggle` (🌙/☀️) en el topbar
- Alterna `body.dark` y persiste en `localStorage` bajo `ag_dark_mode`
- Overrides en `main.css` bajo `body.dark { ... }`

### Badge color tokens (CSS variables, `:root` en `main.css`)

| Variable | Uso |
|----------|-----|
| `--c-ok-bg/fg` | Verde — activo, alta, éxito |
| `--c-warn-bg/fg` | Amarillo — advertencia |
| `--c-danger-bg/fg` | Rojo — error, baja |
| `--c-info-bg/fg` | Azul — info, movimiento |
| `--c-purple-bg/fg` | Violeta — amortizaciones |
| `--c-orange-bg/fg` | Naranja — rollos, impuestos |
| `--c-pink-bg/fg` | Rosa — fardos |

Se adaptan automáticamente al dark mode.

---

## Alertas / Recordatorios (`app.js`)

- Botón 🔔 (`#btn-alertas`) en topbar con badge rojo de ítems vencidos/hoy
- Panel `#alerts-panel` (fixed, z-index 200) con tres categorías: vencidos (rojo), hoy (amarillo), próximos 30 días (azul)
- Key `ag_alertas`: `{ id, titulo, fecha, completado }`
- Funciones: `refreshAlertBadge()`, `renderAlertsList()`, `toggleAlertsPanel()`

---

## Autenticación (Supabase Auth)

- Pantalla de login `#login-screen` — se muestra si no hay sesión activa
- Botón `#btn-logout` en topbar — cierra sesión y recarga
- Email del usuario en `.topbar-user`
- RLS: política `auth.uid() = user_id`; cada usuario solo ve sus datos
- PK de `app_data`: `(user_id, key)`
- Crear usuarios: Supabase Dashboard → Authentication → Users → Add user

---

## Assets

**Sidebar art** (`.sidebar-art`): `margin-top: auto` la empuja al fondo; gradiente via `::before`; `height: 190px`, `object-fit: cover`.

**Fondo de la app**: `background: var(--color-bg) url('../assets/campo-bg.jpg') center/cover fixed`. Topbar con `backdrop-filter: blur(10px)`. Dark mode: overlay `rgba(0,0,0,0.72)`.

---

## Git y deploy

- **Remote:** `git@github.com:ConraPal/agostos-app.git` (SSH)
- **Clave SSH:** ed25519 en `~/.ssh/id_ed25519`, registrada en GitHub (ConraPal)
- **Rama principal:** `main`
- **Deploy:** Vercel desde `main` — `https://agostos-app.vercel.app` (migrado desde GitHub Pages)

---

## Notas de desarrollo

- **Capa de storage aislada**: los módulos solo llaman `Storage.get()` / `Storage.set()`. El backend vive en `storage.js`.
- **Sin build step**: se puede abrir `index.html` directo en el navegador.
- **IDs**: timestamps `Date.now()` como strings.
- **`.hidden`**: clase utilitaria (`display: none !important`) para ocultar elementos del topbar.
- **Tooltips**: `<span class="tooltip-trigger" tabindex="0" data-tip="...">?</span>` — CSS puro con `::after` y `opacity` transition.

---

## Contexto de mercado

### Posicionamiento

Agostos App apunta al **productor ganadero chico/familiar argentino** — el nicho que los grandes no atienden bien.

### Competidores principales

- **Albor Campo**: ERP completo, medianas-grandes. Muy complejo para nuestro target.
- **Auravant**: Agricultura de precisión, ganadería limitada.
- **Agrobit**: Enterprise + SAP.
- **Apps ganaderas (Huella, Ñandú, Kelpie, Digirodeo)**: cada una cubre un aspecto, ninguna integra todo.

### Ventaja competitiva

1. Offline-first nativo (67% del campo tiene mala conectividad)
2. Simplicidad radical (UX pensada para quien viene de la libreta)
3. Foco ganadero real
4. Freemium (gratis hasta 100 cabezas)
5. Mobile-first + WhatsApp como canal de distribución

### Archivos de referencia

- `docs/MARKET_RESEARCH.md` — Investigación completa
- `docs/TODO_ROADMAP.md` — Roadmap en 3 fases

### Roadmap

1. **Fase 1 (MVP)** ✅ COMPLETO — rodeo + sanidad + económico básico + offline + PWA + bimonetario + PDF + WhatsApp share + home screen + UX pill-tabs
2. **Fase 2** — indicadores productivos + plan sanitario + reportes PDF avanzados
3. **Fase 3** — trazabilidad + satelital + monetización
