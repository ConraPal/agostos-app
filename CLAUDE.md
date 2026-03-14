# Agostos — Gestión de Campo

App web de gestión de campo construida con tecnologías vanilla, sin frameworks ni dependencias externas.

## Stack

- **HTML5** — estructura semántica, un `index.html` por ahora (SPA sin build step)
- **CSS3** — variables CSS, sin preprocesador ni utilidades externas
- **JavaScript vanilla (ES6+)** — módulos como IIFEs, sin bundler
- **localStorage** — persistencia local por ahora (sin backend)

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
│   ├── storage.js      # Wrapper de localStorage — se carga primero
│   ├── livestock.js    # Módulo hacienda — se carga segundo
│   ├── finance.js      # Módulo finanzas — se carga tercero
│   ├── fields.js       # Módulo potreros — se carga cuarto
│   ├── reports.js      # Módulo reportes — se carga quinto
│   └── app.js          # Bootstrap + ui.toast() + ui.confirm() — se carga último
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

| Key               | Contenido                              |
|-------------------|----------------------------------------|
| `ag_animals`      | Array de animales registrados          |
| `ag_movements`    | Array de movimientos entre potreros    |
| `ag_history`      | Log automático de eventos por animal   |

### Estructura de un animal

```js
{
  id:            String,   // timestamp como string
  caravana:      String,   // identificador único, ej: "AR-0042"
  nombre:        String,
  tipo:          String,   // "vaca" | "toro" | "ternero" | "vaquillona" | "novillo"
  raza:          String,
  nacimiento:    String,   // ISO date
  potrero:       String,
  estado:        String,   // "activo" | "vendido" | "muerto"
  peso:          Number,   // kg
  observaciones: String
}
```

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

## Módulo: Finanzas

### Propósito

Registro de ingresos y gastos del campo, con resumen por categoría.

### Datos persistidos en localStorage

| Key                | Contenido                        |
|--------------------|----------------------------------|
| `ag_transactions`  | Array de transacciones           |

### Estructura de una transacción

```js
{
  id:            String,   // timestamp como string
  fecha:         String,   // ISO date elegida por el usuario
  tipo:          String,   // "ingreso" | "gasto"
  categoria:     String,
  monto:         Number,
  descripcion:   String,
  observaciones: String
}
```

### Categorías

**Ingreso:** Venta de animales · Arrendamiento · Subsidios · Otro ingreso

**Gasto:** Compra de animales · Veterinaria · Alimentación · Combustible · Maquinaria · Sueldos · Otro gasto

Las categorías se cargan dinámicamente en el modal según el tipo seleccionado.

### Stats

- **Balance** — total ingresos − total gastos (rojo si negativo)
- **Total ingresos** — suma de todas las transacciones de tipo `ingreso`
- **Total gastos** — suma de todas las transacciones de tipo `gasto`
- **Transacciones del mes** — count de transacciones del mes en curso

### Tabs del módulo

- **Transacciones** — CRUD con búsqueda por descripción/categoría y filtro por tipo ✓
- **Resumen** — breakdown de totales por categoría, separado en ingresos y gastos ✓

## Módulo: Potreros

### Propósito

Gestión de campos y pasturas del establecimiento, con visibilidad de stock por potrero.

### Datos persistidos en localStorage

| Key          | Contenido                  |
|--------------|----------------------------|
| `ag_fields`  | Array de potreros          |

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

### Stats

- **Total potreros** — count de potreros registrados
- **Total hectáreas** — suma de hectáreas
- **En uso** — potreros con al menos un animal activo asignado
- **Libres** — total − en uso

### Tabs del módulo

- **Potreros** — CRUD con búsqueda por nombre/pastura, badges de estado ✓
- **Stock** — tabla que cruza `ag_animals` activos con potreros; muestra cantidad y caravanas; potreros con animales pero sin registrar aparecen marcados como "sin registrar" ✓

### Notas de integración

- `Fields.refresh()` está expuesto y es llamado desde `app.js` cada vez que el usuario navega al módulo, para mantener el tab Stock actualizado con cambios hechos en Hacienda.
- El campo `potrero` de los animales es texto libre; el cruce con `ag_fields` se hace por coincidencia exacta de nombre.

## Módulos planificados

| Módulo     | Estado    | Descripción                                        |
|------------|-----------|----------------------------------------------------|
| Hacienda   | Completo  | Registro, movimientos e historial funcionando      |
| Finanzas   | Completo  | Transacciones, stats y resumen por categoría       |
| Potreros   | Completo  | CRUD de potreros y stock por potrero               |
| Reportes   | Completo  | Stock por tipo/potrero, balance mensual, exportar CSV |

## Módulo: Reportes

### Propósito

Resúmenes cruzados entre módulos y exportación de datos a CSV.

### Tabs del módulo

- **Hacienda** — stock activo por tipo (con %) y por potrero (con %), total al pie ✓
- **Finanzas** — balance mensual del año en curso: ingresos, gastos, balance por mes con fila de totales ✓
- **Exportar** — descarga CSV de animales, movimientos, transacciones y potreros ✓

### Notas

- No tiene action button en el topbar (solo lectura).
- `Reports.refresh()` es llamado desde `app.js` al activar el módulo para mostrar datos actualizados.

## UI Utilities (`app.js`)

### `ui.toast(msg, type?)`

Muestra una notificación flotante en la esquina inferior derecha. `type` puede ser `'success'` (default) o `'error'`. Se desvanece automáticamente a los 2.8s.

### `ui.confirm(msg, okLabel?)`

Abre un modal de confirmación y devuelve una Promise que resuelve `true` (confirmó) o `false` (canceló). Reemplaza todos los `confirm()` nativos del navegador.

## Integración entre módulos

- El campo **Potrero** en el modal de animales usa `<datalist id="potrero-options">` poblado desde `ag_fields` (estado activo) al abrir el modal.
- El campo **Destino** en el modal de movimientos usa `<datalist id="destino-options">` con la misma fuente.
- Al guardar un movimiento con un destino no registrado en `ag_fields`, se ofrece registrarlo vía `ui.confirm()`. Si el usuario acepta, se crea con estado `activo` y datos vacíos.

## Assets

| Archivo              | Uso                                                       |
|----------------------|-----------------------------------------------------------|
| `assets/gaucho.png`  | Ilustración estilo Molina Campos — gaucho a caballo       |

La imagen se ubica al pie del sidebar (`<div class="sidebar-art">`). Estilos en `main.css`:
- `margin-top: auto` la empuja al fondo del sidebar
- `::before` aplica un gradiente de `--color-sidebar` a transparente para fundirla con la navegación
- `height: 148px`, `object-fit: cover`, `object-position: center 30%`, `opacity: .82`

## Git y deploy

- **Remote:** `git@github.com:ConraPal/agostos-app.git` (SSH)
- **Autenticación:** clave SSH ed25519 en `~/.ssh/id_ed25519`, registrada en GitHub bajo la cuenta ConraPal.
- **Rama principal:** `main`
- **Deploy:** GitHub Pages habilitado desde `main` — URL pública: `https://conrapal.github.io/agostos-app/`

## Notas de desarrollo

- **localStorage es temporal**: cuando se incorpore backend, `storage.js` es el único archivo a reemplazar. Los módulos llaman solo a `Storage.get()` y `Storage.set()`.
- **Sin build step**: se puede abrir `index.html` directo en el navegador para desarrollo local.
- **IDs**: se usan timestamps (`Date.now()`) como IDs. Suficiente para localStorage; cambiar a UUIDs si se migra a backend.
- **`.hidden`**: clase utilitaria en `main.css` (`display: none !important`) usada para ocultar elementos del topbar al cambiar de módulo.
