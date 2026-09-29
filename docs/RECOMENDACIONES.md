# Recomendaciones de calidad, escala y rendimiento

Estado de partida: la aplicación funciona de extremo a extremo y tiene pruebas de regresión, pero está dimensionada para un piloto. Este documento ordena lo que falta para operarla como un SaaS comercial.

Prioridad: **P0** antes de recibir clientes reales · **P1** primer trimestre en producción · **P2** al crecer.

## 1. Antes de abrir al público (P0)

| # | Recomendación | Por qué |
|---|---|---|
| 1 | Integrar una pasarela de pago real tras `PaymentGateway`, con confirmación por webhook firmado | Hoy la compra no cobra. El estado "pagado" debe venir del proveedor de pagos, no de la respuesta del navegador |
| 2 | Entregar los planos comprados: archivos privados con enlaces firmados de corta duración | Hoy la compra habilita cotizar, pero no descarga ningún archivo |
| 3 | Lista de materiales definida por el profesional, por diseño | La estimación por metro cuadrado sirve para orientar, no para comprar. Es el dato que da valor a la cotización |
| 4 | Acuerdos y conexión con ferreterías reales | Sin proveedores reales la cotización es una demostración |
| 5 | Desactivar el repositorio público o revisar su licencia | El código del producto es visible para cualquiera |
| 6 | Términos de uso, política de privacidad y consentimiento conforme a la Ley 8968 | Se guardan nombres, correos y teléfonos de personas en Costa Rica |
| 7 | Facturación electrónica conforme a Hacienda | Obligatoria para vender en Costa Rica |
| 8 | Límite de solicitudes en Redis o en la base, no en memoria | El límite actual se pierde al reiniciar y no se comparte entre réplicas |
| 9 | Protección contra abuso en formularios públicos (límite por IP y verificación humana) | `/validation-leads` y `/plan-interests` aceptan envíos anónimos sin límite |
| 10 | Copias de seguridad con restauración probada y entorno de staging separado | Una copia que nunca se restauró no es una copia |

## 2. Calidad del código

- **Corregir las discrepancias heredadas** listadas en [ARQUITECTURA.md](ARQUITECTURA.md): baños con decimales, inversión mínima mayor que máxima, y transiciones de moderación sin estado previo. (P0)
- **Restricciones en la base.** Agregar `CHECK` para estados, `m2 >= 20` y consistencia de inversión, tras auditar los datos. La validación solo en la API no protege contra escrituras directas. (P1)
- **Dividir `routes/validation.ts`** por dominio (planos, perfiles, almacenamiento, administración). Con 700 líneas mezcla cuatro responsabilidades. (P1)
- **Pruebas unitarias** para el estimador de materiales, el criterio de recomendación y `describeError`. Hoy solo están cubiertos por pruebas de integración. (P1)
- **Integración continua** en GitHub Actions: tipado, pruebas del servidor y prueba de navegador en cada pull request, con una base PostgreSQL efímera. (P0)
- **Ramas protegidas.** Dejar de subir directo a `main`; exigir revisión y CI en verde. (P1)
- **Pruebas de contrato** por conector de proveedor, con respuestas grabadas, para detectar cambios en sus API. (P1)
- **Retirar primitivas de interfaz sin uso.** Hay 55 componentes en `components/ui` y el producto importa 18. (P2)

## 3. Escalabilidad

- **Paginación** en catálogo y listas de administración. Hoy devuelven todas las filas. (P0)
- **Filtros en el servidor.** La búsqueda por título y provincia se hace en el navegador sobre la lista completa. (P1)
- **Cotizaciones en segundo plano.** Mover las llamadas a proveedores a una cola de trabajos con reintentos y notificación al terminar. Hoy la solicitud HTTP espera a todos los conectores. (P1)
- **Conexiones a la base.** Usar el pooler de Supabase en modo transacción y fijar el tamaño del pool por réplica. (P0)
- **Servidor sin estado.** Con el límite de solicitudes y la cola fuera del proceso, la API puede escalar horizontalmente. (P1)
- **Imágenes por CDN.** Servir las variantes públicas desde el CDN de Supabase Storage en lugar de pasar los bytes por Express. (P1)
- **Catálogo de materiales normalizado** con códigos propios y equivalencias por proveedor. Permite comparar el mismo producto entre ferreterías. (P1)
- **Historial de precios** por material y proveedor, para mostrar tendencias y detectar cotizaciones anómalas. (P2)
- **Organizaciones.** Si se venderá a constructoras o desarrolladores, modelar cuentas de empresa con varios usuarios y roles. (P2)

## 4. Rendimiento

- **División del código por ruta** con `React.lazy`. El panel de administración y el editor de planos se descargan hoy para todos los visitantes. (P1)
- **Imágenes adaptables** con `srcset` usando las variantes de 640 y 1600 px que ya se generan. (P1)
- **`reconcileRemovedPlanImages` lee todos los planos** para saber si una imagen sigue en uso. Sustituir por una consulta indexada o una tabla de referencias. (P1)
- **Caché HTTP** con `ETag` para el catálogo público y el resumen de portada. (P2)
- **Presupuesto de rendimiento** medido en CI con Lighthouse: LCP menor a 2.5 s en 4G. (P2)
- **Fuentes autoalojadas** en lugar de Google Fonts, para evitar una conexión adicional y el salto de texto. (P2)

## 5. Seguridad

- **Cabeceras de seguridad** (`helmet`) y política de contenido estricta. (P0)
- **Validación de firma de tipo de archivo** al recibir la carga, no solo al publicar. (P1)
- **Registro de auditoría** de acciones de administración: quién aprobó, rechazó o registró una cotización. (P1)
- **Rotación de secretos** y gestor de secretos del proveedor de hosting. (P0)
- **Roles en Clerk** como metadatos firmados, en lugar de una lista de IDs en una variable de entorno. (P1)
- **Revisión de dependencias** automática y actualización mensual. (P1)
- **Prueba de penetración** antes del lanzamiento comercial. (P1)

## 6. Operación y observabilidad

- **Seguimiento de errores** (Sentry o equivalente) en web y API, enlazado con `requestId`. (P0)
- **Métricas y alertas**: latencia p95, tasa de errores 5xx, tasa de éxito por conector de proveedor, tiempo medio de respuesta de cotizaciones manuales. (P1)
- **Comprobación de salud profunda** que verifique base y almacenamiento, separada de la comprobación simple. (P1)
- **Página de estado** pública y procedimiento de incidentes. (P2)
- **Analítica de producto**: embudo visita → ficha → compra → cotización → pedido. (P1)

## 7. Experiencia de usuario

- **Correos transaccionales**: confirmación de compra, cotización lista, perfil aprobado o rechazado. Hoy el usuario debe volver a entrar para enterarse. (P0)
- **Menú móvil.** En pantallas pequeñas se ocultan Catálogo y Mi Portal sin alternativa. (P1)
- **Confirmación en acciones de moderación**, que hoy se ejecutan con un solo clic. (P1)
- **Estados traducidos.** Administración muestra `pending`, `approved` y `draft` en inglés. (P1)
- **Exportar la cotización** a PDF para compartirla con el maestro de obras o el banco. (P1)
- **Precios en colones y dólares** con tipo de cambio de referencia del BCCR. (P2)
- **Accesibilidad**: auditoría WCAG 2.2 AA con lector de pantalla; la prueba actual cubre teclado y foco. El texto blanco sobre terracota tiene contraste 4.2:1, por debajo del 4.5:1 que exige el texto normal. (P1)

## 8. Integración con ferreterías

Es el diferenciador del producto y merece plan propio.

1. **Empezar con el conector manual.** Permite operar con cualquier ferretería desde el primer día y medir demanda antes de invertir en integraciones.
2. **Priorizar por volumen.** Integrar por API primero a los proveedores que reciban más solicitudes.
3. **Portal del proveedor.** Una pantalla donde la ferretería responde sus cotizaciones elimina la digitación por parte de administración.
4. **Formatos de intercambio.** Muchos proveedores no tienen API pero sí exportan listas de precios. Un importador de CSV o Excel cubre ese caso.
5. **Del presupuesto al pedido.** El siguiente paso es convertir la cotización aceptada en una orden de compra con seguimiento de entrega, que es donde se puede cobrar comisión.
6. **Vigencia y disponibilidad.** Revalidar precio y existencias al aceptar una cotización; los materiales cambian de precio con frecuencia.

## Orden sugerido

| Etapa | Contenido |
|---|---|
| 1. Lanzamiento controlado | Todos los P0: pagos, entrega de planos, lista de materiales real, legal, CI, observabilidad, correos |
| 2. Primeros clientes | Cola de cotizaciones, portal del proveedor, paginación y filtros, auditoría, menú móvil |
| 3. Crecimiento | Pedidos con seguimiento, historial de precios, organizaciones, CDN y presupuesto de rendimiento |
