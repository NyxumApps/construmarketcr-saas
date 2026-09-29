# ConstruMarket CR

Marketplace de diseños arquitectónicos para Costa Rica. Profesionales verificados por CFIA publican planos; los compradores los adquieren y cotizan los materiales con ferreterías y proveedores del país.

## Estructura

```text
artifacts/api-server        API Express 5 (rutas, almacenamiento, pagos, proveedores)
artifacts/construmarket-cr  Aplicación web React + Vite + Tailwind v4 + shadcn/ui
lib/db                      Modelos Drizzle y conexión PostgreSQL
lib/api-spec                Contrato OpenAPI (fuente de la validación y del cliente)
lib/api-zod                 Validación generada para el servidor
lib/api-client-react        Hooks de TanStack Query generados para la web
supabase/migrations         Migraciones SQL versionadas
scripts/migrate.mjs         Aplica las migraciones pendientes
docs/                       Arquitectura, recomendaciones y libro de marca
```

## Puesta en marcha

Requisitos: Node 22, pnpm 10 y una base PostgreSQL (Supabase o local).

```bash
pnpm install
```

```bash
cp .env.example .env
```

Complete `.env` y luego aplique las migraciones:

```bash
pnpm run db:migrate
```

En dos terminales:

```bash
pnpm run dev:api
```

```bash
pnpm run dev
```

La web queda en `http://localhost:3000` y reenvía `/api` al servidor en el puerto 8080.

## Variables de entorno

| Variable | Dónde se obtiene |
|---|---|
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string |
| `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_PUBLISHABLE_KEY` | Clerk → API Keys → Publishable key |
| `CLERK_SECRET_KEY` | Clerk → API Keys → Secret key |
| `ADMIN_CLERK_USER_IDS` | Clerk → Users → ID del usuario (`user_...`), separados por comas |
| `SESSION_SECRET` | Genere uno con `openssl rand -hex 32` |
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → clave secreta |
| `ALLOWED_ORIGINS` | Dominio público de la web, obligatorio en producción |
| `PAYMENT_PROVIDER` | `sandbox` registra la compra sin cobrar |

Sin las claves de Clerk la web muestra una pantalla de configuración pendiente y la API responde 401 en las rutas con sesión. Sin las claves de Supabase Storage las imágenes se guardan en disco local (solo desarrollo).

## Pruebas

Las pruebas crean datos marcados como sintéticos y no borran nada. Ejecútelas contra una base de desarrollo, nunca contra producción.

```bash
pnpm run typecheck
```

```bash
pnpm run test
```

```bash
pnpm run test:pilot-browser
```

| Suite | Qué comprueba |
|---|---|
| `test:pilot` | Sesión, perfil CFIA, carga de imágenes, moderación y contactos |
| `test:pending-upload-cleanup` | Limpieza de cargas abandonadas con exclusión entre procesos |
| `test:commerce` | Contrato de errores, compra, proveedores y cotizaciones |
| `test:pilot-browser` | Recorrido completo en navegador, con teclado y a 320 px |

## Cambiar el contrato de la API

Edite `lib/api-spec/openapi.yaml` y regenere la validación y el cliente:

```bash
pnpm run codegen
```

## Agregar una ferretería

- **Sin API**: en Administración → Proveedores. Las solicitudes llegan a la pestaña Cotizaciones, donde se registra la respuesta del proveedor.
- **Con API**: implemente `SupplierConnector` en `artifacts/api-server/src/lib/suppliers/` y regístrelo en `registry.ts`. El conector recibe la lista de materiales y devuelve precios, plazo y vigencia.

## Documentación

- [Arquitectura y decisiones de la migración](docs/ARQUITECTURA.md)
- [Recomendaciones de calidad, escala y rendimiento](docs/RECOMENDACIONES.md)
- [Libro de marca](docs/marca/LIBRO_DE_MARCA.md)
