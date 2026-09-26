# Auditoría funcional del canvas ERP — 25 septiembre 2026

## Objetivo y método

Se contrastó la pregunta con el origen, el período, los filtros, la medida,
la visualización y los registros de respaldo. Se ejecutaron 90 pruebas de
Vitest, build y lint; se enviaron consultas al `/api/compose` local y se
inspeccionaron las vistas en navegador de escritorio y móvil (390 × 844).
Una respuesta HTTP 200 no cuenta como éxito si devuelve una vista distinta a
la solicitada.
La pasada automática de accesibilidad no encontró infracciones confirmadas;
el contraste de texto dentro de gráficos SVG quedó como revisión manual
pendiente porque el analizador no pudo determinar su fondo.

## Resultado de la segunda pasada

| Solicitud | Resultado comprobado |
| --- | --- |
| 10 clientes que más facturaron este mes | 10 clientes identificables ordenados por suma de facturas emitidas; gráfico de barras y tabla, no MRR. |
| Clientes que más facturaron hoy | Solo facturas de hoy, con nombre e importe; sin sustituir otro día. |
| Crecimiento de nómina respecto al mes anterior | Fórmula, porcentaje, importes de ambos meses y dos registros de respaldo. |
| Notas de crédito emitidas y consumidas este mes | Emitido, aplicado y disponible reconciliados, con detalle por nota. |
| Cuentas por cobrar / facturas de proveedor pendientes | Se excluyen facturas pagadas; el importe usa solo documentos abiertos. |
| Facturas vencidas | Se exige estado abierto y vencimiento anterior a hoy; si la muestra no contiene registros, se indica explícitamente. |
| Cuentas por cobrar vs cuentas por pagar | Gráfico conjunto de saldos abiertos y tabla que define cada base; no se confunde con cobros o pagos. |
| Gastos por categoría | Origen ERP demo en RD$, agrupado por categoría, sin cifras SaaS en USD. |
| POS de ayer | Solo tickets de ayer; si no existen, se muestra ausencia del período. |
| Productos sin stock por almacén / tardanzas por departamento | Conteo virtual tras filtrar registros; dimensión y gráfico solicitados. |
| Nómina bruta por departamento | Suma de bruto por departamento en gráfico de barras y tabla de respaldo, no lista genérica de empleados. |
| Torta del porcentaje de nómina por departamento, incluso con errores de escritura | Gráfico de cuatro porciones, importes brutos y porcentajes por departamento que suman 100 %; también se comprobó la variante de nómina neta en pruebas. |
| Facturas pagadas por cliente en tarta | Solo estado Pagada, agrupación por cliente y componente circular. |

El flujo ERP nuevo usa `BusinessPlan`: campos autorizados, filtros tipados,
período, agrupación, medida, límite y tipo de vista. El servidor ejecuta el
plan sobre un proveedor de solo lectura, genera componentes declarativos
controlados y compara la salida con los registros. Luna puede generar un plan
si no existe uno preparado; Jev evalúa en paralelo si puede reutilizar una
receta. Ninguno ejecuta JSX, SQL ni llamadas arbitrarias al ERP generadas por
el modelo. Las preguntas ERP no cubiertas dejan de caer en un dashboard SaaS
genérico: sin un plan válido o sin el modelo configurado se explica el límite.

## Hallazgos todavía abiertos

1. **No hay Odoo conectado.** Todos los importes indicados como demo son
   simulados. Para contestar cualquier pregunta del negocio hacen falta
   adaptadores autenticados y limitados por empresa para los modelos de Odoo,
   además de definiciones acordadas de devengo, cobro, saldo, impuestos y
   moneda. No se puede verificar cobertura universal con esta muestra.
2. **No existe memoria compartida durable de recetas.** El registro actual
   vive en el código. Jev puede detectar un hueco, pero una receta nueva no
   se guarda ni se reutiliza entre usuarios. Requiere base de datos,
   versionado, aislamiento por empresa, revisión y migración de esquemas.
3. **La generación visual está acotada al catálogo.** Luna genera planes y
   composiciones declarativas; no crea componentes React nuevos en producción.
   Para capacidades no representables hay que ampliar el catálogo seguro o
   diseñar un formato declarativo de interacciones con validación y sandbox.
4. **No hay sesión/autorización ni persistencia segura del canvas.** La
   historia se pierde al recargar. Guardar datos contables en `localStorage`
   sería una mala solución para una integración real; debe persistirse en el
   servidor bajo identidad, permisos y empresa.
5. **Períodos y consultas complejas:** los flujos heredados aún tienen
   muestras fijas de septiembre de 2026. Uniones arbitrarias, series mensuales
   de módulos que solo tienen registros de un mes y preguntas de pagos sin
   fecha de pago verificable se rechazan en vez de inventarse. Hay que ampliar
   cobertura de eventos y un motor de relaciones/medidas tipadas.
6. **Operación:** el límite por minuto es local al proceso, no distribuido;
   falta telemetría de fidelidad por consulta, evaluación contra un conjunto
   amplio de preguntas reales y pruebas del camino Luna/Jev con credenciales
   del entorno desplegado. El reconocimiento de voz se configuró en `es-DO`,
   pero depende del navegador y no se verificó con audio humano.

## Criterio para la siguiente fase

Antes de prometer “cualquier pregunta”, conectar un entorno Odoo de prueba,
definir los permisos y el diccionario semántico, registrar trazas sin datos
sensibles, y evaluar un conjunto representativo de preguntas con validación
humana. La aceptación debe medir exactitud de datos **y** forma solicitada,
no solo que se haya renderizado una tarjeta o un gráfico.
