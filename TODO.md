# TODO — Agostos

Mejoras priorizadas de menor a mayor esfuerzo/riesgo.

---

## A — Bugs / Correcciones menores

1. Agregar `radix` a todos los `parseInt()` sin él → `parseInt(x, 10)`
2. Agregar `aria-label` a botones de acción (editar/eliminar) que usan solo emojis
3. Agregar `overflow-x: auto` a tablas en mobile (indicador de scroll horizontal)

---

## B — Validaciones y UX

4. Validar nombres duplicados al crear potreros
5. Limpiar `castracion_fecha` al guardar animales que no sean terneros
6. Agregar debounce (~300ms) al input de búsqueda en todas las tablas
7. Responsive para `.resumen-grid` y `.export-grid` en ≤768px (falta breakpoint)

---

## C — Features nuevas simples

8. **Búsqueda en Reproducción** — filtro por año
9. **Ordenamiento de columnas** en tabla de Animales (por tipo, peso)
10. **Filtro por año** en tabs Cultivos y Forraje
11. **Paginación en Cultivos, Forraje, Amortizaciones** (consistencia con el resto)

---

## D — Features de datos

12. **Backup/Restore** — exportar todo localStorage como JSON + importar
13. **Importar CSV de animales** — carga masiva desde planilla

---

## E — Reportes adicionales

14. **Reporte de Reproducción** en módulo Reportes — % preñez y % destete por año (cruce de ciclos)
15. **Reporte de Forraje** — stock total por tipo (rollos/fardos)

---

## F — Mejoras visuales / UX avanzado

16. **Dark mode** — variable CSS swap con `prefers-color-scheme` + toggle manual
17. **Tooltips de ayuda** en campos no obvios (ej: vida útil en amortizaciones)
18. **Badge consolidado** — crear clases CSS utilitarias `.badge-ok`, `.badge-warn`, `.badge-neutral` y eliminar las definiciones duplicadas de verde/rojo en cada módulo
