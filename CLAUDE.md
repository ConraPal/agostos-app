# Agostos — Gestión de Campo

App web de gestión de campo construida con tecnologías vanilla, sin frameworks ni dependencias externas.

## Stack

- **HTML5** — estructura semántica, un `index.html` por ahora (SPA sin build step)
- **CSS3** — variables CSS, sin preprocesador ni utilidades externas
- **JavaScript vanilla (ES6+)** — módulos como IIFEs, sin bundler
- **Supabase** — backend principal (tabla `app_data`); `localStorage` como fallback automático

## Configuración Claude Code

`.claude/settings.json` — modo de permisos `acceptEdits`: Edit y Bash corren sin confirmación manual.

## Arquitectura

### Estructura de carpetas

```
agostos-app/
├── index.html          # Entry point único — contiene sidebar, topbar y todos los módulos
├── css/
│   ├── main.css        # Estilos globales: layout, sidebar, tablas, modales, formularios, toast, confirm
│   ├── livestock.css   # Estilos específicos del módulo hacienda
│   ├── finance.css     # Estilos específicos del módulo finanzas
│   ├── fields.css      # Estilos específicos del módulo potreros
│   └── reports.css     # Estilos específicos del módulo reportes
├── js/
│   ├── storage.js      # Supabase + localStorage fallback — se carga primero
│   ├── livestock.js    # Módulo hacienda — se carga segundo
│   ├── finance.js      # Módulo finanzas — se carga tercero
│   ├── fields.js       # Módulo potreros — se carga cuarto
│   ├── reports.js      # Módulo reportes — se carga quinto
│   └── app.js          # Bootstrap + ui.toast() + ui.confirm() + ui.pagination() — se carga último
└── assets/
    └── icons/
```

### Convenciones de módulos

Cada módulo del campo (hacienda, potreros, finanzas, etc.) sigue este patrón:

- **HTML**: sección `<section id="module-{nombre}">` en `index.html`
- **CSS**: archivo propio en `css/{nombre}.css`
- **JS**: IIFE exportada como `const NombreModulo = (() => { ... return { init, ... }; })();`
- El módulo expone siempre un método `init()` que registra listeners y hace el primer render
- **Keys de localStorage**: prefijo `ag_` para evitar colisiones (ej: `ag_animals`, `ag_movements`)

### Routing

No hay router de URL. La navegación entre módulos es visual (mostrar/ocultar secciones `.module`). El sidebar maneja el estado activo con clases CSS.

Al cambiar de módulo, `app.js` también actualiza el título del topbar y alterna la visibilidad del botón de acción correspondiente (cada módulo tiene su propio botón en el topbar, oculto con `.hidden` cuando el módulo no está activo).

### Mobile / Responsive

Breakpoints implementados en `main.css` y `livestock.css`:

| Breakpoint   | Cambios                                                                 |
|--------------|-------------------------------------------------------------------------|
| `≤ 768px`    | Sidebar se convierte en overlay deslizable; aparece botón hamburger (☰) |
| `≤ 768px`    | Stats grid pasa de 4 → 2 columnas; form-row pasa a 1 columna           |
| `≤ 480px`    | Stats grid pasa a 1 columna; labels de botones del topbar se ocultan   |

**Sidebar mobile:**
- El sidebar se posiciona `fixed` con `left: -220px` por defecto
- `body.sidebar-open` lo muestra (`left: 0`) con transición CSS
- `#sidebar-overlay` cubre el contenido con fondo semitransparente; al clickearlo cierra el sidebar
- Navegar a cualquier módulo también cierra el sidebar automáticamente
- El toggle lo maneja `app.js` con `document.body.classList.toggle('sidebar-open')`

### Orden de carga de scripts

```html
<script src="js/storage.js"></script>   <!-- 1. utilidades base -->
<script src="js/livestock.js"></script> <!-- 2. módulos -->
<script src="js/finance.js"></script>   <!-- 3. módulos -->
<script src="js/fields.js"></script>    <!-- 4. módulos -->
<script src="js/reports.js"></script>   <!-- 5. módulos -->
<script src="js/app.js"></script>       <!-- 6. bootstrap (inicia módulos) -->
```

### Tabs

Los tabs están scoped al módulo padre: el handler de click en `app.js` usa `.closest('.module')` para activar/desactivar solo los tabs y tab-contents del módulo actualmente visible. Esto evita conflictos entre módulos.

## Módulo: Livestock Tracking (Hacienda)

### Propósito

Registro, seguimiento y gestión del stock de animales del campo.

### Datos persistidos en localStorage

| Key                | Contenido                              |
|--------------------|----------------------------------------|
| `ag_animals`       | Array de animales registrados          |
| `ag_movements`     | Array de movimientos entre potreros    |
| `ag_history`       | Log automático de eventos por animal   |
| `ag_reproduction`  | Array de ciclos reproductivos          |

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
  castracion_fecha: String,   // ISO date — solo relevante para terneros; null si no aplica
  observaciones:    String
}
```

- `#row-castracion` en el modal se muestra/oculta según el tipo seleccionado (solo visible para `ternero`).
- En la tabla se muestra "Castrado" como subtexto debajo del tipo cuando `castracion_fecha` existe.

### Estructura de un movimiento

```js
{
  id:            String,   // timestamp como string
  timestamp:     String,   // ISO datetime de creación
  fecha:         String,   // ISO date elegida por el usuario
  animalId:      String,   // referencia al id del animal
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
  fecha:    String,   // ISO datetime de cuando se generó el evento
  caravana: String,
  nombre:   String,
  evento:   String,   // "Alta" | "Actualización" | "Baja" | "Movimiento"
  detalle:  String
}
```

### Estructura de un ciclo reproductivo

```js
{
  id:                      String,   // Date.now()
  año:                     Number,
  // Servicio
  fecha_entrada_toros:     String,   // ISO date
  fecha_salida_toros:      String,   // ISO date
  // Tacto
  tacto_fecha:             String,   // ISO date
  vacas_total:             Number,   // vacas servidas
  vacas_positivas:         Number,
  vacas_negativas:         Number,   // calculado: total - positivas
  prenez_pct:              Number,   // calculado: positivas / total * 100
  // IA (opcional)
  ia_realizada:            Boolean,
  ia_fecha:                String,   // ISO date
  ia_toro:                 String,
  ia_prenez_pct:           Number,   // % preñez solo de IA
  // Parición
  paricion_inicio:         String,   // ISO date
  paricion_fin:            String,   // ISO date
  partos:                  Number,
  muertes_paricion:        Number,
  // Destete
  destete_fecha:           String,   // ISO date
  terneros_machos_destete: Number,
  terneras_hembras_destete:Number,
  muertes_destete:         Number,
  // Calculados
  indice_destete:          Number,   // (machos+hembras) / partos * 100
  mortalidad_total:        Number,   // muertes_paricion + muertes_destete
  observaciones:           String
}
```

**Índices clave:**
- **Índice de preñez** = vacas_positivas / vacas_total × 100
- **Índice de destete** = (terneros_machos + terneras_hembras) / partos × 100
- **Mortalidad total** = muertes_paricion + muertes_destete

### Funcionalidades implementadas

**Tab Registro**
- CRUD completo de animales con formulario modal
- Stats en tiempo real: total, vacas, toros, terneros (solo estado `activo`)
- Búsqueda por caravana o nombre, filtro por tipo
- Cada alta, edición y baja escribe automáticamente en `ag_history`

**Tab Movimientos**
- Formulario modal para registrar un movimiento
- Búsqueda de animal con dropdown personalizado (filtra por caravana o nombre, máx 8 resultados, navegable con ↑ ↓ Enter Escape)
- Al seleccionar un animal, se auto-completa el campo potrero origen con su potrero actual
- Tipos de movimiento: traslado, entrada, salida
- Al guardar: persiste en `ag_movements`, actualiza el campo `potrero` del animal en `ag_animals` (si hay destino), y escribe en `ag_history`
- Tabla ordenada por fecha desc; desempate por timestamp

**Tab Historial**
- Muestra todas las entradas de `ag_history` ordenadas por fecha desc
- Columnas: fecha, caravana + nombre del animal, tipo de evento con badge de color, detalle
- Badges por tipo: verde (Alta), rojo (Baja), amarillo (Actualización), azul (Movimiento)
- Cubre los 4 eventos del módulo: Alta, Actualización, Baja y Movimiento
- Entradas anteriores sin campo `nombre` se muestran sin problema (campo opcional)

**Tab Reproducción**
- Stats (4 cards): % preñez último ciclo, % destete último ciclo, vacas positivas, mortalidad total
- Tabla: Año, Vacas servidas, % Preñez, Partos, % Destete, Mortalidad, IA (sí/no), Acciones
- Modal con sección IA (toggle con `#fr-ia`), sección Parición, sección Destete
- Funciones: `renderReproduccion()`, `openModalRepro(id?)`, `closeModalRepro()`, `saveRepro(e)`, `editRepro(id)`, `removeRepro(id)`

### `logHistory(caravana, evento, detalle, nombre = '')`

Función interna del módulo. Llamada desde los 4 puntos de escritura:

| Caller        | Evento          | Detalle                          |
|---------------|-----------------|----------------------------------|
| `saveAnimal`  | `Alta`          | `Tipo: {tipo}`                   |
| `saveAnimal`  | `Actualización` | `Datos editados`                 |
| `remove`      | `Baja`          | `Eliminado del registro`         |
| `saveMovement`| `Movimiento`    | `{tipo} de {origen} a {destino}` |

### Tabs del módulo

- **Registro** — tabla de animales con búsqueda y filtro por tipo ✓
- **Movimientos** — registro de traslados/entradas/salidas entre potreros ✓
- **Historial** — log cronológico con badges por tipo de evento ✓
- **Reproducción** — ciclo productivo biológico completo: servicio, tacto, parición, destete; con índices de preñez, destete y mortalidad ✓

## Módulo: Finanzas

### Propósito

Registro de ingresos y gastos del campo, con resumen por categoría, amortizaciones y cálculo de margen.

### Datos persistidos en localStorage

| Key                 | Contenido                        |
|---------------------|----------------------------------|
| `ag_transactions`   | Array de transacciones           |
| `ag_amortizations`  | Array de activos amortizables    |

### Estructura de una transacción

```js
{
  id:             String,   // timestamp como string
  fecha:          String,   // ISO date elegida por el usuario
  tipo:           String,   // "ingreso" | "gasto" | "impuesto"
  categoria:      String,
  monto:          Number,
  descripcion:    String,
  observaciones:  String,
  // Campos opcionales para ventas (auto-calculan monto)
  cantidad:       Number,   // cabezas o toneladas
  precio_unitario:Number,   // precio por cabeza/unidad
  peso_kg:        Number,   // peso total en kg (ventas por peso)
  precio_kg:      Number    // precio por kg
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

### Categorías

**Ingreso (ventas):** Toros · Vacas vacías · Terneros machos · Terneras hembras · Novillos · Vaquillonas · Cereales · Arrendamiento · Subsidios · Otro ingreso

**Gasto (costos operativos):** Personal · Vacunas · Semillas · Agroquímicos · Labranzas · Cosechas · Almacenamiento · Enfardados · Gastos veterinarios · Reparaciones maquinaria · Reparaciones generales · Aplicaciones agroquímicos · Varios · Combustibles · Electricidad · Materiales y herramientas

**Impuesto/Retención:** Ganancias · Impuesto inmobiliario · Tasas municipales · Patentes · Seguros

Las categorías se cargan dinámicamente en el modal según el tipo seleccionado.

**Campos opcionales en ventas de animales:**
- Por peso (Terneros machos, Terneras hembras, Novillos, Vaquillonas): `peso_kg` + `precio_kg` → auto-calcula `monto`
- Por cabeza (Toros, Vacas vacías, Cereales): `cantidad` + `precio_unitario` → auto-calcula `monto`

### Stats

- **Balance** — total ingresos − total gastos (rojo si negativo)
- **Total ingresos** — suma de todas las transacciones de tipo `ingreso`
- **Total gastos** — suma de todas las transacciones de tipo `gasto`
- **Transacciones del mes** — count de transacciones del mes en curso

### Tabs del módulo

- **Transacciones** — CRUD con búsqueda por descripción/categoría y filtro por tipo (ingreso/gasto/impuesto) ✓
- **Resumen** — breakdown de totales por categoría, separado en ingresos y gastos ✓
- **Amortizaciones** — CRUD de activos; stats de total activos y cuota anual total ✓
  - Funciones: `renderAmortizaciones()`, `openModalAmort(id?)`, `saveAmort(e)`, `removeAmort(id)`
- **Margen** — cálculo del margen agropecuario filtrado por año ✓
  - Funciones: `renderMargen(año)`, `initMargenYear()`

### Fórmulas del margen

- **Ingresos** = Σ transacciones tipo `ingreso` del año
- **Costos** = Σ transacciones tipo `gasto` del año
- **Amortizaciones año** = Σ `cuota_anual` de activos con `año >= año_inicio` y `año < año_inicio + vida_util`
- **Margen Bruto** = Ingresos − Costos − Amortizaciones
- **Impuestos** = Σ transacciones tipo `impuesto` del año
- **Margen Neto** = Margen Bruto − Impuestos

Cards con color verde/rojo según signo.

## Módulo: Potreros

### Propósito

Gestión de campos y pasturas del establecimiento, con visibilidad de stock, historial de cultivos y registro de forraje por potrero.

### Datos persistidos en localStorage

| Key               | Contenido                       |
|-------------------|---------------------------------|
| `ag_fields`       | Array de potreros               |
| `ag_crop_history` | Array de registros de cultivos  |
| `ag_forraje`      | Array de registros de forraje   |

### Estructura de un potrero

```js
{
  id:            String,   // timestamp como string
  nombre:        String,   // "Potrero Norte"
  hectareas:     Number,   // puede ser null
  pastura:       String,   // "Natural" | "Mejorada" | "Verdeo" | "Otro"
  estado:        String,   // "activo" | "descanso" | "clausurado"
  observaciones: String
}
```

### Estructura de un registro de cultivo

```js
{
  id:          String,
  potrero_id:  String,   // referencia a ag_fields
  potrero:     String,   // nombre (desnormalizado)
  año:         Number,
  tipo:        String,   // "cultivo" | "pastura"
  detalle:     String,   // "Soja", "Alfalfa 80% / Festuca 20%"
  notas:       String
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

- **Total potreros** — count de potreros registrados
- **Total hectáreas** — suma de hectáreas
- **En uso** — potreros con al menos un animal activo asignado
- **Libres** — total − en uso

### Tabs del módulo

- **Potreros** — CRUD con búsqueda por nombre/pastura, badges de estado ✓
- **Stock** — tabla que cruza `ag_animals` activos con potreros; muestra cantidad y caravanas; potreros con animales pero sin registrar aparecen marcados como "sin registrar" ✓
- **Cultivos** — historial de cultivos/pasturas por potrero con filtro por potrero ✓
  - Badges CSS: `.badge-cultivo-cultivo` (verde), `.badge-cultivo-pastura` (azul)
  - Funciones: `renderCultivos()`, `openModalCultivo(id?)`, `saveCultivo(e)`, `removeCultivo(id)`
- **Forraje** — registro de rollos y fardos por potrero ✓
  - Badges CSS: `.badge-forraje-rollo` (naranja), `.badge-forraje-fardo` (rosa)
  - Funciones: `renderForraje()`, `openModalForraje(id?)`, `saveForraje(e)`, `removeForraje(id)`

### Notas de integración

- `Fields.refresh()` está expuesto y es llamado desde `app.js` cada vez que el usuario navega al módulo, para mantener el tab Stock actualizado con cambios hechos en Hacienda.
- El campo `potrero` de los animales es texto libre; el cruce con `ag_fields` se hace por coincidencia exacta de nombre.

## Módulo: Reportes

### Propósito

Resúmenes cruzados entre módulos y exportación de datos a CSV.

### Tabs del módulo

- **Hacienda** — stock activo por tipo (con %) y por potrero (con %), total al pie ✓
- **Finanzas** — balance mensual del año en curso: ingresos, gastos, balance por mes con fila de totales ✓
- **Reproducción** — tabla de ciclos reproductivos por año: preñez, partos, destete, mortalidad ✓
- **Forraje** — totales de rollos y fardos + desglose por potrero ✓
- **Exportar** — descarga CSV de animales, movimientos, transacciones y potreros; importar CSV de animales; backup/restore JSON completo ✓

### Notas

- No tiene action button en el topbar (solo lectura).
- `Reports.refresh()` es llamado desde `app.js` al activar el módulo para mostrar datos actualizados.

## UI Utilities (`app.js`)

### `ui.toast(msg, type?)`

Muestra una notificación flotante en la esquina inferior derecha. `type` puede ser `'success'` (default) o `'error'`. Se desvanece automáticamente a los 2.8s.

### `ui.confirm(msg, okLabel?)`

Abre un modal de confirmación y devuelve una Promise que resuelve `true` (confirmó) o `false` (canceló). Reemplaza todos los `confirm()` nativos del navegador.

### `ui.pagination(containerId, total, page, pageSize, onPageChange)`

Renderiza controles de paginación dentro del elemento `containerId`. Si `total <= pageSize` (una sola página), vacía el contenedor y no muestra nada. `onPageChange` recibe el número de página destino.

**Tablas paginadas (20 filas por página):**

| Tabla         | containerId               | Estado de página   | Módulo       |
|---------------|---------------------------|--------------------|--------------|
| Animales      | `animals-pagination`      | `animalsPage`      | livestock.js |
| Movimientos   | `movements-pagination`    | `movementsPage`    | livestock.js |
| Historial     | `history-pagination`      | `historyPage`      | livestock.js |
| Transacciones | `transactions-pagination` | `transactionsPage` | finance.js   |
| Cultivos      | `cultivos-pagination`     | `cultivosPage`     | fields.js    |
| Forraje       | `forraje-pagination`      | `forrajePage`      | fields.js    |
| Amortizaciones| `amort-pagination`        | `amortPage`        | finance.js   |

Al cambiar filtro o búsqueda, el módulo resetea la página a 1 antes de renderizar.

### `ui.debounce(fn, ms?)`

Retorna una versión con debounce de la función `fn`. Por defecto `ms = 300`. Usado en los inputs de búsqueda para evitar renders en cada keystroke.

## Integración entre módulos

- El campo **Potrero** en el modal de animales usa `<datalist id="potrero-options">` poblado desde `ag_fields` (estado activo) al abrir el modal.
- El campo **Destino** en el modal de movimientos usa `<datalist id="destino-options">` con la misma fuente.
- Al guardar un movimiento con un destino no registrado en `ag_fields`, se ofrece registrarlo vía `ui.confirm()`. Si el usuario acepta, se crea con estado `activo` y datos vacíos.

## Assets

| Archivo                   | Uso                                                              |
|---------------------------|------------------------------------------------------------------|
| `assets/vaca-sidebar.jpg` | Foto de vaca Hereford — imagen al pie del sidebar                |
| `assets/campo-bg.jpg`     | Foto de campo con molino — fondo general de la app               |

**Sidebar art** (`<div class="sidebar-art">`). Estilos en `main.css`:
- `margin-top: auto` la empuja al fondo del sidebar
- `::before` aplica un gradiente de `--color-sidebar` a transparente para fundirla con la navegación
- `height: 190px`, `object-fit: cover`, `object-position: center 20%`, `opacity: .9`

**Fondo de la app** (`body`). Estilos en `main.css`:
- `background: var(--color-bg) url('../assets/campo-bg.jpg') center center / cover fixed no-repeat`
- El topbar usa `backdrop-filter: blur(10px)` con fondo semitransparente para efecto vidrio esmerilado
- En dark mode: overlay `rgba(0,0,0,0.72)` sobre la imagen para mantener legibilidad

## Git y deploy

- **Remote:** `git@github.com:ConraPal/agostos-app.git` (SSH)
- **Autenticación:** clave SSH ed25519 en `~/.ssh/id_ed25519`, registrada en GitHub bajo la cuenta ConraPal.
- **Rama principal:** `main`
- **Deploy:** GitHub Pages habilitado desde `main` — URL pública: `https://conrapal.github.io/agostos-app/`

## Notas de desarrollo

- **Capa de storage aislada**: los módulos solo llaman `Storage.get()` y `Storage.set()`. El backend vive enteramente en `storage.js`.
- **Sin build step**: se puede abrir `index.html` directo en el navegador para desarrollo local.
- **IDs**: se usan timestamps (`Date.now()`) como IDs.
- **`.hidden`**: clase utilitaria en `main.css` (`display: none !important`) usada para ocultar elementos del topbar al cambiar de módulo.

---

## Actualizaciones 17/03/2026

### Dark mode

- Botón `#btn-dark-toggle` (🌙/☀️) en el topbar, junto a los botones de acción.
- Al hacer click, alterna `body.dark` y persiste en `localStorage` bajo la key `ag_dark_mode`.
- Los overrides de dark mode están en `main.css` bajo `body.dark { ... }`.
- Las variables CSS de color (`--color-bg`, `--color-surface`, etc.) y de badges (`--c-*-bg/fg`) se redefinen en el bloque `body.dark`.

### Badge color tokens (CSS variables)

Definidas en `:root` en `main.css`:

| Variable         | Uso                          |
|------------------|------------------------------|
| `--c-ok-bg/fg`   | Verde — activo, alta, éxito  |
| `--c-warn-bg/fg` | Amarillo — advertencia       |
| `--c-danger-bg/fg` | Rojo — error, baja         |
| `--c-info-bg/fg` | Azul — info, movimiento      |
| `--c-purple-bg/fg` | Violeta — amortizaciones   |
| `--c-orange-bg/fg` | Naranja — rollos, impuestos|
| `--c-pink-bg/fg`   | Rosa — fardos              |

Todos los módulos (livestock.css, finance.css, fields.css) usan estas variables en lugar de colores hardcoded. Se adaptan automáticamente al dark mode.

### Sort en tabla de Animales

- Las columnas **Tipo** y **Peso** tienen la clase `.sortable-th` y `data-sort="tipo"` / `data-sort="peso"`.
- El estado de sort (`animalsSort.by` y `animalsSort.dir`) vive en `livestock.js`.
- Al hacer click en un header ya ordenado, alterna `asc` ↔ `desc`.
- La flecha `⇅/▲/▼` se renderiza dentro del `<span class="sort-arrow">`.
- La columna **Peso** fue agregada a la tabla (antes de Estado).

### Filtros por año

- **Reproducción** (`#repro-year-filter`) — en `livestock.js`, estado `reproYear`.
- **Cultivos** (`#cultivos-year-filter`) — en `fields.js`, state implícito en el select.
- **Forraje** (`#forraje-year-filter`) — en `fields.js`, state implícito en el select.
- Los selects se pueblan dinámicamente con los años existentes en los datos.

### Paginación nueva

Cultivos, Forraje y Amortizaciones ahora usan `ui.pagination()` con `PAGE_SIZE = 20`.

### Backup / Restore

- **Exportar JSON** (`#btn-export-backup`): descarga un `.json` con todos los arrays de localStorage + `_version` y `_date`.
- **Restaurar JSON** (`#btn-import-backup`): lee el archivo y restaura todas las keys. El usuario debe recargar la página para ver los datos.
- Manejado en `reports.js`.

### Importar CSV animales

- **Importar CSV** (`#btn-import-csv`): lee un CSV con el formato del exportado (header en fila 1, caravana en col 2).
- Las caravanas ya existentes se omiten.
- Muestra toast con conteo de importados y omitidos.
- Manejado en `livestock.js` — función `importCSV(file)`.

### Tooltips

Implementados con `<span class="tooltip-trigger" tabindex="0" data-tip="...">?</span>` dentro del label. Muestran el tooltip en hover/focus via CSS puro (`::after` con `opacity` transition). Ubicados en:
- Modal amortización: Año inicio y Vida útil
- Modal reproducción: % Preñez IA
- Modal movimientos: Potrero origen

## Actualizaciones 18/03/2026

### Supabase — backend persistente

- **Proyecto:** `zetsiitizxrtgmlkkuqo` (us-west-2) — activo y saludable.
- **Tabla:** `app_data` — `key text PK`, `value jsonb`. RLS habilitado con política "Allow all" (app de uso personal).
- **CDN:** `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2` cargado antes de `storage.js` en `index.html`.

### `Storage` — arquitectura nueva (`storage.js`)

`Storage` es ahora una IIFE con cuatro métodos públicos: `init()`, `get()`, `set()`, `remove()`.

**Flujo de `init()` (async, llamado desde `app.js` con `await`):**
1. Intenta conectar a Supabase con la publishable key.
2. Si `app_data` está vacío → migra arrays no vacíos de `localStorage` a Supabase (one-time).
3. Si hay datos → los carga al cache en memoria.
4. Si falla → modo fallback: carga `localStorage` al cache y opera offline.

**Flujo de `set(key, value)`:**
- Actualiza el cache inmediatamente (lectura síncrona).
- Si Supabase activo: `upsert` fire-and-forget en background.
- Si fallback: escribe en `localStorage`.

**Keys LOCAL_ONLY** (nunca van a Supabase): `ag_dark_mode`.

**Loading overlay:** `#app-loading` (spinner CSS) se muestra durante `Storage.init()` y se oculta al resolverse.
