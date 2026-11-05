# Reingeniería: ConstruMarket CR en Next.js, Neon y v0

Fecha: 5 de noviembre de 2026. Sustituye la pila de la migración de septiembre (Vite + Express + Supabase) por una sola aplicación Next.js generada por fases en v0. Las reglas de negocio, el contrato de la API, el esquema de datos, el sistema visual y el contrato de errores son los ya definidos en [ARQUITECTURA.md](ARQUITECTURA.md), [ESPECIFICACION_ORIGINAL.md](ESPECIFICACION_ORIGINAL.md) y [openapi.yaml](../lib/api-spec/openapi.yaml); no cambian.

## Pila objetivo

| Capa | Antes | Ahora | Motivo |
|---|---|---|---|
| Web y API | Vite + Express en monorepo pnpm | Next.js App Router: páginas y Route Handlers bajo `/api` | Un solo despliegue en Vercel; v0 lo genera y previsualiza de forma nativa |
| Base de datos | Supabase Postgres | **Neon** Postgres 17, driver `@neondatabase/serverless` | Serverless con ramas por entorno; integración directa en v0 y Vercel |
| Imágenes | Supabase Storage | **Vercel Blob** (acceso privado) + tabla `stored_objects` | Neon no tiene almacenamiento de objetos; Blob se integra en v0 |
| Autenticación | Clerk | Clerk (`@clerk/nextjs`, español) | Es lo que fija la especificación |
| Pagos | Interfaz `PaymentGateway` con `sandbox` | Igual | Sin cambios |
| Proveedores | `SupplierConnector` con `demo` y `manual` | Igual | Sin cambios |
| Validación | Zod generado desde OpenAPI | Zod escrito a mano con las mismas reglas | v0 no corre Orval; el contrato sigue siendo `openapi.yaml` |

## Esquema en Neon

`docs/esquema-neon.sql` es el esquema consolidado, idempotente (`IF NOT EXISTS`), sin RLS ni bucket de Supabase. Se ejecuta una vez en la rama principal de Neon y en cada rama de desarrollo. Las 11 tablas y sus índices son los mismos de `supabase/migrations`.

## Qué cambia en el flujo de imágenes

Mismo contrato (`request-url` → `PUT` binario → `stored_objects` con visibilidad), pero el cuerpo de la carga no puede pasar por una función de Vercel (límite de 4,5 MB). Por eso el navegador sube directo a Vercel Blob con una URL firmada por el servidor (`handleUpload` de `@vercel/blob/client`), y el servidor registra la fila en `stored_objects` al confirmar. Las variantes WebP de 1600 y 640 px se generan en el navegador, como en el original; `sharp` las verifica al publicar el plano.

## Fases en v0

Cada fase termina con una vista previa funcional y un commit a GitHub desde v0.

| Fase | Entregable | Criterio de salida |
|---|---|---|
| 1. Base pública | Esquema en Neon, utilidades de servidor, contrato de errores, portada, catálogo, ficha de diseño, registro de interés, pantalla de "configuración pendiente" | Navegar portada → catálogo → ficha con datos de demostración; errores y estados vacíos visibles |
| 2. Cuentas y profesionales | Clerk en español, `/portal`, perfil CFIA, editor de planos con galería en Blob | Un profesional crea un plano con imágenes y lo envía a revisión |
| 3. Moderación | `/admin` con Resumen, Profesionales, Diseños y Leads | Un administrador aprueba un perfil y publica un plano |
| 4. Comercio | Compra en modo prueba, lista de materiales, proveedores, cotizaciones y comparación | Un comprador compra, cotiza con el proveedor demo y uno manual, y administración responde |
| 5. Cierre | README, `.env.example`, semillas de demostración, pruebas de humo, revisión de accesibilidad a 320 px | Todas las pantallas de la especificación recorribles con teclado |

## Variables de entorno

```dotenv
DATABASE_URL=                      # Neon, cadena con pooler
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
ADMIN_CLERK_USER_IDS=
BLOB_READ_WRITE_TOKEN=             # Vercel Blob
SESSION_SECRET=
PAYMENT_PROVIDER=sandbox
```

## Qué pasa con el código de septiembre

El monorepo Vite + Express queda como referencia de comportamiento y de pruebas de regresión. Las suites `test:pilot`, `test:commerce` y `pilot-browser` describen el comportamiento esperado y conviene portarlas a la nueva aplicación en la fase 5.
