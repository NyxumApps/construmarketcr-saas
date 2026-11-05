# ConstruMarket CR — especificación maestra para reconstrucción fuera de Replit

Alcance: estado del código de este repositorio, no un volcado de la base de datos ni una garantía sobre datos desplegados. **Actual** significa comportamiento comprobable en código; **adaptación** significa trabajo por hacer en el nuevo entorno. Cursor es el editor, Claude puede asistir con lógica y v0 puede generar componentes; ninguno sustituye las reglas de servidor descritas aquí. La aplicación real es `artifacts/construmarket-cr` + `artifacts/api-server` + `lib/*`; `artifacts/mockup-sandbox` es un laboratorio de diseños, no el producto operativo.

## 1. Especificaciones de UI y frontend para v0

### 1.1 Tecnología y sistema visual actual

React + TypeScript + Vite, Tailwind CSS **v4** (`@tailwindcss/vite`), `shadcn/ui` estilo **new-york** (componentes fuente locales, no paquete monolítico), primitivas Radix, Lucide, `class-variance-authority`, `clsx`/`tailwind-merge`, `wouter` para rutas, TanStack Query para estado remoto, React Hook Form + Zod para formularios, Clerk React + temas/localización `esES`. Hay dependencias adicionales en el manifiesto que no necesariamente se usan en las pantallas del piloto; no deben interpretarse como funcionalidades existentes. `src/index.css` es la fuente de verdad de tokens, `components.json` configura alias `@/`, CSS variables y componentes. `src/App.tsx` monta Clerk, QueryClient (staleTime 5 min; no refetch al enfocar), tooltips, Toast y un ErrorBoundary que se reinicia al cambiar la ruta. Todo el sitio está en español.

| Token | Claro HSL | Hex aprox. | Oscuro HSL | Uso |
|---|---|---|---|---|
| background | `40 30% 98%` | `#FBFAF8` | `160 40% 10%` | lienzo |
| foreground | `160 20% 10%` | `#141F1B` | `40 30% 98%` | texto |
| primary / ring | `160 40% 15%` | `#17362B` | `15 60% 50%` | CTA, foco |
| primary-foreground | `0 0% 100%` | `#FFFFFF` | `0 0% 100%` | texto de CTA |
| secondary | `15 60% 50%` | `#CC5933` | `160 20% 25%` | acento |
| border / input / card-border | `105 10% 87%` | `#DCE1DB` | `160 20% 20%` | divisiones |
| card / popover | `0 0% 100%` | `#FFFFFF` | `160 30% 12%` | superficies |
| muted / accent | `105 10% 92%` | `#EAEDE9` | `160 20% 20%` | fondos suaves |
| muted-foreground | `160 10% 40%` | `#5C7069` | `160 10% 60%` | texto auxiliar |
| destructive | `0 84% 60%` | `#EF4343` | `0 84% 60%` | errores |

En claro `card-foreground`, `popover-foreground` y `accent-foreground` son `160 20% 10%`; `secondary-foreground` y `destructive-foreground` son blanco. En oscuro los primeros usan `40 30% 98%`; `secondary-foreground` también usa ese tono. `--primary-border`, `--secondary-border`, `--muted-border`, `--accent-border`, `--destructive-border` se calculan con CSS Color 5 mediante `hsl(from hsl(var(--primary)) h s calc(l + var(--opaque-button-border-intensity)) / alpha)` y expresiones equivalentes para cada color; la intensidad resta 8 puntos de luminosidad. `--button-outline=rgba(0,0,0,.1)`, `--badge-outline=rgba(0,0,0,.05)`, `--elevate-1=rgba(0,0,0,.03)`, `--elevate-2=rgba(0,0,0,.08)`. Fuente de cuerpo **DM Sans**, títulos **Outfit**, importadas desde Google Fonts. Radio base `0.5rem`; `sm=base−4px`, `md=base−2px`, `lg=base`, `xl=base+4px`. Espaciado: escala estándar de Tailwind (unidad `0.25rem`); el contenedor usa `px-4 md:px-8`, navbar `h-16`, hero `pt-20 pb-32 lg:pt-32 lg:pb-48`. No hay una escala de spacing personalizada declarada. Focus visible global: outline de 3px con `--ring` y offset 3px. `.glass-panel`: blanco al 80%, blur, borde claro y sombra; versión oscura negro al 40%. Las páginas usan tarjetas, badges, skeletons, tabs, select, slider, switch y toast de la carpeta `components/ui`; respetar estados de teclado/foco. Clerk usa tema shadcn con primario `160 40% 15%`, DM Sans, radio `0.5rem`, tarjeta de 440px máximo y botón de 44px de alto.

### 1.2 Mapa exacto de vistas

Todas las rutas pasan por `wouter` con `basePath=import.meta.env.BASE_URL` y ErrorBoundary. `Navbar` sticky translúcida (logo ConstruMarket**CR**, Catálogo y Mi Portal visibles desde `md`, CTA comenzar o cerrar sesión), `Footer` con enlaces Inicio/Catálogo/Registrarse y copyright dinámico. En ancho menor que `md` se ocultan los enlaces secundarios de la barra, pero el logo y el CTA o cierre de sesión siguen visibles; no inventar un drawer que no está implementado.

| Ruta | Acceso y composición vigente |
|---|---|
| `/` | Visitante: hero con imagen, badge y dos CTA; métricas públicas; calculadora de inversión; avance de catálogo con tres planos; registro de interés en pestañas comprador/profesional; footer. Con sesión redirige a `/portal`. |
| `/catalogo` | Pública: título, descripción, búsqueda por título, select de estilo y provincia; rejilla de tarjetas con imagen/encuadre, estilo, autor, m², habitaciones, baños e inversión; enlace a ficha y estado vacío con limpiar filtros. |
| `/plan/:id` | Pública: skeleton inicial; imagen principal y galería si hay múltiples imágenes, etiquetas de tipo/estilo, autor verificado, medidas, descripción; columna/tarjeta de precio del plano e inversión estimada y formulario Contactar Profesional. ID inexistente/no publicado muestra no encontrado. |
| `/sign-in/*?`, `/sign-up/*?` | Formularios Clerk localizados, centrados sobre fondo neutro y gradiente; `sign-up?intent=professional` redirige después a `/portal/profesional`, registro corriente a `/portal`. Solo el modo E2E sustituye sign-in por botón de prueba. |
| `/portal` | Sesión requerida, redirige fuera si no hay sesión. Tarjetas según rol: comprador (catálogo y alta profesional), profesional (estado CFIA y acceso a diseños solo si aprobado), administrador (enlace al panel). |
| `/portal/profesional` | Sesión: banner de estado (pendiente, aprobado, rechazado con observaciones) y formulario de datos CFIA. Guardar reenvía a revisión. |
| `/portal/planos` | Sesión: bloqueo para rol ajeno y para profesional no aprobado (mensaje y enlace a perfil); profesional aprobado ve lista de sus diseños, tarjetas de estado y formulario crear/editar con editor de imágenes. |
| `/admin` | Sesión y rol admin comprobados en UI y API: pestañas Resumen, Profesionales, Diseños, Leads. Métricas, tarjetas de revisión con notas y acciones, lista de contactos. En móvil las pestañas ocupan dos filas y las acciones se apilan. |
| cualquier otra | Página `not-found.tsx`, sin lógica comercial. |

### 1.3 Especificación de componentes complejos para generación UI

Para v0, generar **componentes presentacionales**, luego conectar hooks/API y permisos reales; no confiar en ocultar un botón como autorización.

| Componente | Inputs y reglas | Estados y resultado visible |
|---|---|---|
| Calculadora en inicio | Slider área `40..500 m²`, paso 5, inicial 150; acabado estándar (USD 700–950/m²), prémium (950–1300), lujo (1300–2000); `min=área×tarifa mínima`, `max=área×tarifa máxima`; formato USD sin decimales con `Intl.NumberFormat('en-US')`. | Cálculo instantáneo sin red; etiqueta de acabado y rango; es estimación orientativa, no cotización ni valor guardado. |
| Contadores/planes de portada | GET `/validation-summary` y `/plans`; tarjetas de métricas y hasta 3 planos, fotografías importadas desde `attached_assets/generated_images` como fallback visual de portada. | Contadores muestran guion mientras cargan; planes usan skeleton; no atribuir al servidor datos ficticios. Error de consulta no tiene un flujo de reintento dedicado en la portada actual. |
| Registro comprador | nombre ≥2, email válido, provincia requerida, interés opcional; POST `/validation-leads` con `audience=buyer`. | Pestaña seleccionable; errores de campo por Zod; botón pendiente; toast éxito y reset; toast destructivo si falla. |
| Registro profesional de portada | nombre ≥2, email válido, teléfono ≥8, CFIA no vacío; POST `/validation-leads` con `audience=professional`. | Errores de campo, pendiente; éxito con toast/reset y navegación a registro profesional; error con toast. Este registro no crea un perfil aprobado. |
| Filtros y tarjetas de catálogo | Buscar título localmente; estilo `todos/tropical/minimalista/colonial/rustico`, provincia `todas` + siete provincias; la consulta API puede filtrar por type/style/maxM2/bedrooms; la página filtra título/provincia localmente. | 6 skeletons mientras carga, resultados enlazados, imagen posicionada según focalX/Y (50/50 por defecto), estado sin resultados y botón limpiar. Error de red no cuenta con tarjeta de error específica. |
| Ficha/interés | Ruta con ID numérico; contacto requiere nombre ≥2, email válido, teléfono ≥8, provincia, mensaje ≥5; POST `/plan-interests` con `planId`. | Skeleton; estado 404 con mensaje y retorno; error genérico aparte; botón “Enviando…” durante mutación, toast y reset en éxito, toast destructivo en error. |
| Perfil CFIA | Nombre ≥2, email válido, teléfono ≥8, CFIA ≥3, tipo profesional (arquitecto/ingeniero civil/empresa), provincia entre siete opciones, biografía ≥20. | Skeleton al cargar; estado actual y notas de rechazo; formulario precargado; envío con indicador pendiente y toast; al guardar queda pendiente de revisión aunque antes estuviese aprobado. |
| Lista y editor de planos | Nombre ≥3, descripción ≥20, tipo casa/cabaña/apartamento, estilo y provincia requeridos, m² ≥20, cuartos/baños ≥0, pisos ≥1, precio e inversión min/máx ≥1, switch enviar a revisión; UI exige al menos una imagen al crear. API exige `imageUrl` incluso si no hay imágenes. | Bloqueo de perfil no aprobado; skeleton/estado vacío/lista; formulario crear/editar y cancelar; al guardar invalidar lista y mostrar toast; borrador o pendiente según switch. Editar uno publicado vuelve a pendiente. |
| Editor de portada/galería | JPG/PNG/WebP hasta 12 MiB por carga, máximo 10 imágenes; por imagen original + WebP de ancho máx. 1600 + miniatura WebP máx. 640; `alt` máx. 160 según API; foco horizontal/vertical 0..100, inicial 50; orden por controles arriba/abajo, quitar imagen, primera = portada. | Preview, foco ajustable con puntero/rangos y `object-position`; controles deshabilitados durante carga o en extremos del orden; error de decodificación/subida mediante toast. `createImageBitmap` tiene fallback HTMLImageElement. Solicitar URL → PUT binario → guardar rutas, alt y foco. No almacenar URLs `blob:` en servidor. |
| Moderación | Cuatro tabs; resumen de pendientes/publicados/leads; tarjetas profesionales con CFIA/contacto/bio, notas opcionales y aprobar/rechazar solo si pendientes; planos con preview/autor/descripción y publicar/rechazar solo si pendientes; leads con plan, fecha, comprador, contacto y mensaje. | Skeleton/empty por lista; toast tras acciones; resumen se consulta cada 15 s, contactos cada 15 s solo con pestaña activa; contador de nuevos contactos compara totales desde que se vio el tab (no es push en segundo plano). No hay modales de confirmación implementados. |

Las cuatro variantes en `mockup-sandbox/src/components/mockups` (editorial, refinada, cola de revisión y catálogo split rail) usan interacciones de demostración y datos de ejemplo; **no** reemplazan el diseño ni los flujos productivos. La UI de producción no implementa Dashboard de Obras, Reportes, pagos ni checkout.

## 2. Base de datos y persistencia PostgreSQL

### 2.1 Modelo vigente y DDL ejecutable

ORM **Drizzle** con `node-postgres`, esquema exportado por `lib/db/src/schema/index.ts`. Son seis tablas repartidas en cinco módulos. PK serial (`integer` con secuencia), `timestamp with time zone`, `numeric(10,2)/(12,2)`, `jsonb`; los montos regresan como `number` en DTO, aunque Drizzle los lee como cadena. No existen migraciones SQL versionadas en el repositorio: `drizzle-kit push` sincroniza el esquema. No hay declaraciones `pgEnum`, `check()` ni relaciones `relations()` de Drizzle; los tipos de relación son FK en las columnas. En las referencias sin opción `onDelete/onUpdate`, PostgreSQL usa `NO ACTION` por defecto. La única excepción es el propietario de carga pendiente con `ON DELETE CASCADE`.

Este SQL crea un esquema **vacío equivalente al Drizzle actual**, en una base dedicada. Nombres de restricciones explícitos para reproducibilidad; en instalación preexistente contrastar antes de aplicar. No se agregan `CHECK` ni enums inexistentes: los `enum` del OpenAPI son validación de API y la base almacena `text`. `UNIQUE` crea sus índices B-tree automáticamente. Ejecutarlo una sola vez en la base nueva:

```sql
BEGIN;
CREATE TABLE users (
  id serial PRIMARY KEY,
  clerk_user_id text NOT NULL CONSTRAINT users_clerk_user_id_unique UNIQUE,
  role text NOT NULL DEFAULT 'buyer',
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE validation_leads (
  id serial PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  province text,
  audience text NOT NULL,
  cfia_number text,
  interest text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE professional_profiles (
  id serial PRIMARY KEY,
  user_id integer NOT NULL CONSTRAINT professional_profiles_user_id_users_id_fk
    REFERENCES users(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  cfia_number text NOT NULL,
  professional_type text NOT NULL,
  province text NOT NULL,
  bio text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  is_synthetic boolean NOT NULL DEFAULT false,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT professional_profiles_user_id_unique UNIQUE (user_id),
  CONSTRAINT professional_profiles_cfia_number_unique UNIQUE (cfia_number)
);
CREATE TABLE plans (
  id serial PRIMARY KEY,
  professional_id integer NOT NULL CONSTRAINT plans_professional_id_professional_profiles_id_fk
    REFERENCES professional_profiles(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
  title text NOT NULL,
  slug text NOT NULL CONSTRAINT plans_slug_unique UNIQUE,
  description text NOT NULL,
  type text NOT NULL,
  style text NOT NULL,
  m2 integer NOT NULL,
  bedrooms integer NOT NULL,
  bathrooms integer NOT NULL,
  floors integer NOT NULL,
  price_usd numeric(10,2) NOT NULL,
  construction_min_usd numeric(12,2) NOT NULL,
  construction_max_usd numeric(12,2) NOT NULL,
  province text NOT NULL,
  image_url text NOT NULL,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  is_synthetic boolean NOT NULL DEFAULT false,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE pending_plan_image_uploads (
  object_path text PRIMARY KEY,
  owner_user_id integer NOT NULL CONSTRAINT pending_plan_image_uploads_owner_user_id_users_id_fk
    REFERENCES users(id) ON UPDATE NO ACTION ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'pending',
  cleanup_token text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pending_plan_image_uploads_expires_at_idx
  ON pending_plan_image_uploads(expires_at);
CREATE TABLE plan_interests (
  id serial PRIMARY KEY,
  plan_id integer NOT NULL CONSTRAINT plan_interests_plan_id_plans_id_fk
    REFERENCES plans(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  province text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
```

Diagrama de dependencias: `users 1→0..1 professional_profiles 1→N plans 1→N plan_interests`; `users 1→N pending_plan_image_uploads`; `validation_leads` independiente. Los índices reales son seis índices de PK, cuatro índices de unicidad adicionales (`users.clerk_user_id`, `professional_profiles.user_id`, `professional_profiles.cfia_number`, `plans.slug`) y un índice explícito de expiración. No hay índices separados en FK ni en búsquedas por estado. **Adaptación opcional tras auditar datos:** índices de FK/estado, `CHECK (m2>=20)`, consistencia de inversión y `jsonb_typeof(images)='array'`; no atribuirlos al esquema vigente.

Enums personalizados: **ninguno en el estado actual**. Para un rediseño posterior se pueden declarar `CREATE TYPE user_role AS ENUM ('buyer','professional','admin')`, `CREATE TYPE professional_status AS ENUM ('pending','approved','rejected')`, `CREATE TYPE plan_status AS ENUM ('draft','pending','published','rejected')`, `CREATE TYPE upload_state AS ENUM ('pending','associated','cleaning')`, `CREATE TYPE lead_audience AS ENUM ('buyer','professional')` y `CREATE TYPE interest_status AS ENUM ('new')`; estos **no se crean en el DDL equivalente** porque requerirían cambios Drizzle y una migración de datos antes de convertir columnas. `professional_type`, `type`, `style` y `province` se guardan como texto libre desde el punto de vista de SQL. Los enums API de `ReviewInput` incluyen `approved/rejected/published`, pero cada ruta rechaza explícitamente el estado ajeno.

Tipos exportados exactos: `InsertUser`/`User`, `InsertProfessionalProfile`/`ProfessionalProfile`, `InsertPlan`/`Plan`, `InsertPlanInterest`/`PlanInterest`, `InsertValidationLead`/`ValidationLead`. `pendingPlanImageUploadsTable` no exporta tipo insert/select nominal. Los `insert*Schema` son `createInsertSchema(table)` y omiten `id,createdAt` salvo `users` (solo `id,createdAt`), como se transcribe en §6. `plans.images` es arreglo JSON de `{originalPath,webPath,thumbnailPath,alt,focalX?,focalY?}`; no FK a objetos.

### 2.2 Semillas y datos reales

No hay tabla de catálogos, tabla de configuración ni seed SQL de producto: un esquema vacío ya arranca y el catálogo muestra estado vacío, aunque no trae planos de muestra. **Script SQL mínimo idempotente real** (sin filas ficticias necesarias) para confirmar el estado tras crear tablas; `INSERT INTO` no corresponde porque ninguna tabla admite una fila neutral que habilite la aplicación:

```sql
BEGIN;
SELECT count(*) AS users FROM users;
SELECT count(*) AS professional_profiles FROM professional_profiles;
SELECT count(*) AS plans FROM plans;
SELECT count(*) AS plan_interests FROM plan_interests;
SELECT count(*) AS validation_leads FROM validation_leads;
SELECT count(*) AS pending_plan_image_uploads FROM pending_plan_image_uploads;
COMMIT;
```

Si se migra contenido existente, exportar/importar filas reales en orden FK, preservar IDs y sincronizar secuencias `serial` con `setval`, hacer inventario de objetos y verificar referencias/ACL antes de abrir tráfico; no publicar datos sintéticos. El bootstrap administrador existente **no es una semilla anónima**: `bootstrap-admin.mjs` inserta/actualiza `users` por un ID Clerk emitido previamente y exige una identidad externa concreta. Alternativamente `ADMIN_CLERK_USER_IDS` promueve cuentas al autenticarse. Nunca otorgar admin al primer registro.

Imágenes: rutas `/objects/plan-images/<hash-del-dueño>/<uuid>` se mapean al bucket y prefijo configurados por `PRIVATE_OBJECT_DIR`; `plans.image_url` y `plans.images` guardan rutas, no bytes. Además `pending_plan_image_uploads` registra titular, caducidad, estado `pending/associated/cleaning` y token de limpieza. Migrar **también** bytes, `Content-Type`, metadato `custom:aclPolicy` (`{owner,visibility}`), reglas de acceso y nombres de objeto. Original privado; variantes WebP y miniatura públicas cuando se asocian. Un worker de limpieza periódica elimina abandonos; conservar semántica de tokens/arrendamientos y comprobar referencias antes de eliminar.

## 3. Backend, contratos API y reglas de negocio

### 3.1 Convenciones y formas compartidas

Express 5 monta rutas bajo `/api`; `GET/POST/PATCH` JSON con `Content-Type: application/json`, excepto PUT binario de imagen y GET binario. CORS actual refleja origen con credenciales; **adaptación**: limitar orígenes al dominio elegido. Auth mediante sesión Clerk (cookies/headers gestionados por SDK, `@clerk/express` + `getAuth`), no JWT propio; en otro host se debe configurar la instancia/issuer/clave Clerk y cookies/proxy correctos. El ID de Clerk crea usuario local `buyer` si no existe; una allowlist externa puede crear/promover admin; guardar perfil promueve a `professional` salvo admin. Una cabecera `x-test-clerk-user-id` solo funciona si `NODE_ENV=test`: no exponer este bypass en producción. Falta auth: `401 {"error":"Inicie sesión para continuar"}`; no admin: `403 {"error":"Acceso exclusivo para administración"}`.

Modelos de respuesta JSON (campos incluidos, fechas ISO UTC y precios número): `Account={id,clerkUserId,role}`; `ProfessionalProfile={id,userId,name,email,phone,cfiaNumber,professionalType,province,bio,status,reviewNotes,createdAt}`; `Plan={id,professionalId,professionalName,title,slug,description,type,style,m2,bedrooms,bathrooms,floors,priceUsd,constructionMinUsd,constructionMaxUsd,province,imageUrl,images,status,reviewNotes,createdAt}`; `PlanImage={originalPath,webPath,thumbnailPath,alt,focalX,focalY}` (foco ausente en registros antiguos se devuelve 50); `PlanInterest={id,planId,name,email,phone,province,message,planTitle,status,createdAt}`; `ValidationLead={id,name,email,phone,province,audience,cfiaNumber,interest,createdAt}`. La implementación extiende objetos de DB y Zod valida/sanea propiedades de DTO: por ello `isSynthetic` no forma parte del contrato público. `GET /professional-profile` devuelve JSON `null` si falta perfil. Las listas devuelven `[]`. Los errores explícitos usan `{ "error": "mensaje" }`, no un esquema común formal. No hay contrato centralizado de errores 500 para todas las rutas: errores no atrapados pueden pasar al middleware por defecto de Express; no prometer que siempre serán JSON. OpenAPI documenta sobre todo éxitos y omite auth, `includeSynthetic` y muchos errores: esta sección contrasta código + Zod generado con el contrato.

Ejemplos estructurales, con valores ficticios **solo para explicar el contrato**, nunca semillas:

```json
{
  "planInput": {"title":"Casa piloto","description":"Diseño de vivienda ventilada para un lote tropical.","type":"Casa","style":"Tropical","m2":100,"bedrooms":2,"bathrooms":1,"floors":1,"priceUsd":500,"constructionMinUsd":80000,"constructionMaxUsd":120000,"province":"San José","imageUrl":"/api/storage/objects/plan-images/ejemplo/imagen","images":[],"submitForReview":false},
  "image": {"originalPath":"/objects/plan-images/ejemplo/original","webPath":"/objects/plan-images/ejemplo/web","thumbnailPath":"/objects/plan-images/ejemplo/thumb","alt":"Fachada","focalX":50,"focalY":50},
  "profileInput": {"name":"Profesional de ejemplo","email":"ejemplo@example.test","phone":"22223333","cfiaNumber":"CFIA-EXAMPLE","professionalType":"architect","province":"San José","bio":"Experiencia en vivienda tropical sostenible."},
  "interestInput": {"planId":1,"name":"Comprador de ejemplo","email":"comprador@example.test","phone":"88887777","province":"Alajuela","message":"Quisiera más información."},
  "leadInput": {"name":"Visitante de ejemplo","email":"visitante@example.test","audience":"buyer","province":"Heredia"},
  "reviewInput": {"status":"approved","notes":"Documentación revisada"}
}
```

`PlanInput` exige todos los campos indicados excepto `images` (0..10) y `submitForReview`; `PlanUpdate` admite los mismos campos pero todos opcionales, incluido `imageUrl`. Título ≥3, descripción ≥20, m² entero ≥20, habitaciones enteras ≥0, baños enteros ≥0 en API (la UI permite incrementos de 0.5: **discrepancia que se debe resolver al reconstruir**), pisos entero ≥1, precios ≥1; no existe validación API de `min <= max`. `PlanImage` tiene `alt` máximo 160, rutas con prefijo `/objects/plan-images/`, foco 0..100. Perfil: nombre ≥2, email válido, teléfono ≥8, CFIA ≥3, bio ≥20; tipo/provincia textos. Interés: nombre ≥2, email válido, mensaje ≥5; phone/province obligatorios. Lead: nombre ≥2, email válido, audience `buyer|professional`; phone/province/CFIA/interest opcionales. IDs de ruta enteros. Importante: el ejemplo `images:[]` pasa el contrato pero la UI exige imagen nueva; `imageUrl` ficticio no implica un archivo servido.

### 3.2 Inventario exhaustivo de rutas efectivamente montadas

En la columna de salida, `Plan`, `Profile`, `Interest` y `Lead` tienen exactamente las formas arriba; ejemplos de listas `[Plan]`, etc. `∅` indica sin body, no JSON `{}`. `E` denota errores explícitos en la ruta; errores de infraestructura no atrapados **no tienen** formato/status estable. Todos los cuerpos de error mostrados son ejemplos fieles a una rama concreta.

| Método y ruta | Auth; parámetros / body de ejemplo | Éxito (ejemplo de forma) | E: errores explícitos |
|---|---|---|---|
| GET `/api/healthz` | Pública; ∅ | 200 `{"status":"ok"}` | Ninguno específico |
| GET `/api/plans` | Pública; query opcional `type`, `style` (ILIKE substring), `maxM2` entero máximo, `bedrooms` entero mínimo; ∅ | 200 `[Plan]` o `[]`, solo publicados, por fecha ascendente | 400 `{"error":"<detalle de validación Zod>"}` |
| GET `/api/plans/:id` | Pública; `id` entero, ∅ | 200 `Plan` | 400 detalle Zod; 404 `{"error":"Plano no encontrado"}` para inexistente o no publicado |
| POST `/api/plans` | Clerk + perfil aprobado; body `planInput` anterior | 201 `Plan`, `status=draft` o `pending` | 400 detalle Zod; 401 auth; 403 perfil no aprobado o excepción capturada de imágenes/transacción (`{"error":"<mensaje>"}`) |
| PATCH `/api/plans/:id` | Clerk; dueño con perfil aprobado, o admin; `id` entero; body parcial, p. ej. `{"title":"Casa revisada","submitForReview":true}` | 200 `Plan` | 400 `{"error":"Datos inválidos"}`; 401 auth; 403 perfil/imagen; 404 `{"error":"Plano no encontrado"}` incluso si no pertenece al dueño |
| POST `/api/storage/uploads/request-url` | Clerk + perfil aprobado o admin; `{"name":"foto.jpg","size":1024,"contentType":"image/jpeg"}` | 200 `UploadUrlResponse={uploadUrl:string (URL absoluta de la misma instancia hacia /api/storage/uploads/:token),objectPath:string (ruta /objects/plan-images/),publicUrl:string (ruta /api/storage/objects/)}`; el token y el ID se generan y firman, por lo que no existe un valor fijo reutilizable | 400 `{"error":"Seleccione una imagen JPG, PNG o WebP de hasta 12 MB"}`; 401 auth; 403 perfil; 429 límite temporal; 500 `{"error":"No se pudo iniciar la carga"}` |
| PUT `/api/storage/uploads/:token` | Clerk dueño del token; body bytes imagen, `Content-Type` exacto y `Content-Length` idénticos al grant | 204 sin body | 400 `{"error":"El archivo no coincide con la carga autorizada"}` o `{"error":"La carga fue rechazada"}`; 401 auth; 403 grant inválido, expirado o dueño distinto |
| GET `/api/storage/objects/*path` | Pública; path p. ej. `plan-images/<owner>/<id>`; ∅ | 200 bytes con `Content-Type`, `nosniff`, `Content-Disposition:inline`, cache 1 año; **solo ACL pública** | 404 `{"error":"Imagen no encontrada"}`; 500 `{"error":"No se pudo cargar la imagen"}` antes de enviar headers |
| GET `/api/me` | Clerk; ∅ | 200 `Account` (id numérico, clerkUserId externo, role buyer/professional/admin) | 401 auth |
| GET `/api/professional-profile` | Clerk; ∅ | 200 `Profile` o `null` | 401 auth |
| POST `/api/professional-profile` | Clerk; `profileInput` anterior | 200 `Profile` con `status=pending`; actualiza o crea y reinicia notas | 400 detalle Zod; 401 auth |
| GET `/api/my-plans` | Clerk; ∅ | 200 `[Plan]` o `[]` si no tiene perfil | 401 auth |
| POST `/api/plan-interests` | Pública; `interestInput` anterior | 201 `Interest` con `status=new` y `planTitle` | 400 detalle Zod; 404 plan inexistente/no publicado |
| POST `/api/validation-leads` | Pública; `leadInput` anterior | 201 `Lead` (opcionales ausentes persistidos `null`) | 400 detalle Zod |
| GET `/api/validation-summary` | Pública; ∅ | 200 `{"interestedBuyers":0,"interestedProfessionals":0,"samplePlans":0}` (ejemplo de forma) | Ninguno específico |
| GET `/api/admin/summary` | Clerk admin; ∅ | 200 `{"pendingProfessionals":0,"pendingPlans":0,"publishedPlans":0,"totalInterests":0}` | 401 auth; 403 no admin |
| GET `/api/admin/professionals` | Clerk admin; query `includeSynthetic=true` opcional; ∅ | 200 `[Profile]` | 401 auth; 403 no admin |
| PATCH `/api/admin/professionals/:id` | Clerk admin; `id` entero; `{"status":"approved","notes":"Revisado"}` o `rejected` | 200 `Profile` | 400 `{"error":"Revisión inválida"}` (también si status `published`); 401; 403; 404 `{"error":"Profesional no encontrado"}` |
| GET `/api/admin/plans` | Clerk admin; query `includeSynthetic=true` opcional; ∅ | 200 `[Plan]` | 401 auth; 403 no admin |
| PATCH `/api/admin/plans/:id` | Clerk admin; `id` entero; `{"status":"published","notes":"Aprobado"}` o `rejected` | 200 `Plan` | 400 `{"error":"Revisión inválida"}` (también si status `approved`); 401; 403; 404 `{"error":"Plano no encontrado"}` |
| GET `/api/admin/interests` | Clerk admin; query `includeSynthetic=true` opcional; ∅ | 200 `[Interest]` | 401 auth; 403 no admin |

Los endpoints GET/POST/PATCH no listados con 500 específico pueden fallar por DB, parsing o DTO sin captura local; el status/body final puede depender del manejador Express, por lo que **no existe** una respuesta JSON 500 contractual equivalente a la del almacenamiento. La respuesta 200 de `Plan` incluye `professionalName` obtenido por join, `reviewNotes` anulable; sus imágenes devuelven foco por defecto 50. La API `PlanInput` requiere `imageUrl` aunque el servidor lo sustituye por la primera variante web si hay imágenes. El OpenAPI describe el GET de objetos como ruta con `{owner}/{id}`, mientras el servidor usa wildcard y aplica ACL; mantener la restricción de ACL en la adaptación.

### 3.3 Operaciones, cálculo, transacciones y permisos

1. `ensureAccount` extrae ID de sesión Clerk, busca/crea usuario en DB, `buyer` por defecto, `admin` solo por allowlist; al registrar perfil profesional, `role=professional` salvo admin. `requireAccount` y `requireAdmin` son barreras de servidor independientes de la UI. La edición de perfil restablece `pending`.
2. Carga: `SESSION_SECRET` firma HMAC-SHA256 de `{owner,objectPath,size,contentType,expiresAt}` por 15 min. Solicitud limitada a 30 por usuario/15 min en memoria de proceso (no compartida entre réplicas); MIME JPEG/PNG/WebP, `size=1..12,582,912`, nombre 1..180. URL se construye con Origin de request o protocolo/host: **adaptación** validar origen/host contra lista confiable para evitar enlaces controlados por el cliente. PUT exige propietario, MIME y Content-Length idénticos, cuenta bytes exactos, borra objeto en rechazo y registra carga pendiente por 24 h.
3. Publicación de imágenes comprueba que todas las rutas son distintas, propietario o prefijo autorizado, bytes decodificables Sharp (máximo 40 M píxeles, objeto ≤12 MiB); index `%3=0` original privado, `%3=1` WebP ≤1600 px público, `%3=2` WebP ≤640 px público. Guarda ACL en metadatos. El cambio de ACL del bucket ocurre en la secuencia de la transacción SQL, pero **la operación de objetos no es transaccional junto con PostgreSQL**; contemplar reconciliación ante fallo parcial.
4. Crear plano exige perfil `approved` incluso a admin, asigna `slug=slugify(title)+"-"+Date.now()`, guarda numeric como cadenas, `status=pending` si `submitForReview`, si no `draft`; `imageUrl=/api/storage` + primer `webPath` si hay imagen. Las filas de cargas se bloquean y pasan de `pending` a `associated`. El slug basado en milisegundos está sujeto a colisión teórica (hay UNIQUE).
5. Editar plano bloquea fila `FOR UPDATE`, exige propiedad o admin, cambia solo campos enviados, reordena/actualiza imágenes; con `submitForReview` o si estaba publicado cambia a `pending` y borra notas. Las imágenes retiradas se comparan con todas las referencias vigentes, incluidas `image_url`; solo las no usadas vuelven a `pending` con expiración de 24 h. El worker de limpieza corre al iniciar API y de forma periódica; preservar exclusión mediante lease/token.
6. Interés solo se inserta si el plano está publicado; `isSynthetic` se hereda del plano. Resumen público: interesados compradores = leads de audience buyer; profesionales = perfiles aprobados no sintéticos; planes de muestra = publicados no sintéticos. Resumen admin excluye sintéticos; las tres listas admin permiten `includeSynthetic=true` y el resumen no. La UI administra notas y aprobación CFIA/publicación, pero la ruta PATCH de moderación no exige transición previa `pending`: reproduce esta diferencia si se busca equivalencia exacta.

## 4. Árbol de proyecto y dependencias para Cursor

### 4.1 Árbol de fuentes y responsabilidades

Árbol completo a nivel de módulos funcionales; `components/ui/` se desglosa por familia de archivos para evitar confundir los componentes shadcn instalados con vistas de negocio. `node_modules`, `dist`, cachés, binarios y activos de imagen no se copian como texto al documento. El paquete de artefactos de Replit se elimina de una reconstrucción externa.

```text
/
├── package.json                  scripts raíz; exige pnpm
├── pnpm-lock.yaml                lockfile de dependencias
├── pnpm-workspace.yaml           paquetes y catálogo compartido
├── tsconfig.base.json            TypeScript compartido
├── tsconfig.json                 referencias TypeScript
├── .npmrc                        opciones pnpm
├── .replit                       comandos/workflows específicos de Replit
├── replit.md                     notas de colaboración del entorno
├── scripts/
│   ├── package.json              utilidades del workspace
│   ├── src/hello.ts              utilidad de ejemplo
│   └── post-merge.sh             instalación/sincronización tras merge en Replit
├── attached_assets/
│   └── generated_images/         imágenes locales importadas por la portada
├── lib/
│   ├── db/
│   │   ├── drizzle.config.ts     dialecto PostgreSQL y DATABASE_URL
│   │   ├── package.json          push de Drizzle
│   │   └── src/
│   │       ├── index.ts          Pool pg y exportación Drizzle
│   │       └── schema/
│   │           ├── index.ts      barrel de modelos
│   │           ├── users.ts      cuenta y rol
│   │           ├── professional-profiles.ts registro CFIA
│   │           ├── plans.ts      planos y cargas pendientes
│   │           ├── plan-interests.ts contactos por plano
│   │           └── validation-leads.ts interesados previos
│   ├── api-spec/
│   │   ├── openapi.yaml          contrato fuente
│   │   ├── orval.config.ts       generación Orval
│   │   └── package.json
│   ├── api-zod/src/              validación servidor generada desde API
│   └── api-client-react/src/
│       ├── generated/            hooks y tipos generados
│       └── index.ts              exports cliente
└── artifacts/
    ├── api-server/
    │   ├── package.json          dev/build/start/tests/bootstrap
    │   ├── build.mjs             bundling servidor
    │   ├── scripts/bootstrap-admin.mjs  promoción admin por identidad Clerk
    │   ├── src/
    │   │   ├── index.ts          listen PORT + arranque limpieza
    │   │   ├── app.ts            CORS, JSON, Clerk, montaje /api
    │   │   ├── routes/{index,health,validation}.ts  endpoints
    │   │   ├── middlewares/clerkProxyMiddleware.ts proxy identidad
    │   │   └── lib/{logger,objectStorage,pendingUploadCleanup,planImageAssociations}.ts
    │   └── test/                 regresión piloto y limpieza
    ├── construmarket-cr/
    │   ├── package.json          Vite/client tests/typecheck
    │   ├── vite.config.ts        base, puerto, proxy API, plugins
    │   ├── components.json       shadcn
    │   ├── index.html
    │   ├── public/{logo.svg,favicon.svg,robots.txt,planes/} estáticos
    │   ├── test/pilot-browser.mjs recorrido E2E
    │   └── src/
    │       ├── main.tsx          arranque React
    │       ├── App.tsx           providers, rutas, Clerk
    │       ├── index.css         tokens, fuentes, Tailwind
    │       ├── pages/{home,catalogo,plan,portal,portal-profesional,portal-planos,admin,not-found}.tsx
    │       ├── components/layout/{Navbar,Footer}.tsx
    │       ├── components/error-boundary.tsx
    │       ├── components/ui/     primitivas shadcn: button, badge, card,
    │       │   input, textarea, select, form, label, slider, switch, tabs,
    │       │   dialog, alert-dialog, sheet, toast, toaster, tooltip, table,
    │       │   skeleton y otras primitivas disponibles; no son páginas
    │       ├── hooks/{use-mobile,use-toast}.tsx/ts
    │       └── lib/{app-auth,utils}.tsx/ts
    └── mockup-sandbox/          galería aislada, no producción
        ├── mockupPreviewPlugin.ts registro/previews locales
        └── src/components/mockups/ variantes de diseño exploratorias
```

Inventario completo de primitivas actualmente presentes en `artifacts/construmarket-cr/src/components/ui/` (cada nombre corresponde a un archivo `.tsx` y se conserva si se reconstruyen los componentes existentes): `accordion`, `alert-dialog`, `alert`, `aspect-ratio`, `avatar`, `badge`, `breadcrumb`, `button-group`, `button`, `calendar`, `card`, `carousel`, `chart`, `checkbox`, `collapsible`, `command`, `context-menu`, `dialog`, `drawer`, `dropdown-menu`, `empty`, `field`, `form`, `hover-card`, `input-group`, `input-otp`, `input`, `item`, `kbd`, `label`, `menubar`, `navigation-menu`, `pagination`, `popover`, `progress`, `radio-group`, `resizable`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `sonner`, `spinner`, `switch`, `table`, `tabs`, `textarea`, `toaster`, `toast`, `toggle-group`, `toggle`, `tooltip`. Son componentes genéricos (acordeón/dialogs, entradas/formularios, navegación, feedback y visualización), no rutas adicionales. El cliente generado tiene `src/custom-fetch.ts`, `src/generated/api.ts`, `src/generated/api.schemas.ts` y `src/index.ts`; la validación generada tiene `src/generated/api.ts` y `src/index.ts`. El sandbox tiene `src/App.tsx`, `src/index.css`, `src/main.tsx`, `mockupPreviewPlugin.ts` y variantes bajo `src/components/mockups/{catalogo-split-rail,construmarket,editorial}/`, más sus propias primitivas; excluirlo de la reconstrucción productiva salvo que se elija expresamente una variante.

Archivos `.replit-artifact/artifact.toml` en cada artefacto, configuración `.replit`, rutas proxy y sandbox son metadatos de Replit; no llevarlos como dependencia funcional a Cursor. Los archivos generados de API pueden regenerarse desde OpenAPI; contrastar diferencias de contrato antes de hacerlo.

### 4.2 Auditoría explícita de dependencias Replit

| Dependencia/acoplamiento actual | Dónde y sustituto portable |
|---|---|
| `@replit/vite-plugin-runtime-error-modal` | configs Vite web/sandbox; retirar y usar overlay integrado Vite/React ErrorBoundary. |
| `@replit/vite-plugin-cartographer` y `@replit/vite-plugin-dev-banner` | configs Vite + catálogo/manifest; retirar imports, condicional `REPL_ID` y dependencias; el editor Cursor y DevTools/Vite cubren navegación/debug. |
| `@replit/connectors-sdk` | manifiesto raíz; no hay importación de runtime localizada para el piloto. Retirar tras verificar usos en futuras ramas; integrar servicios directamente con SDK estándar si llegan a necesitarse. |
| Almacenamiento gestionado por Replit | `ObjectStorageService` usa `@google-cloud/storage` **con credenciales external_account del sidecar local `127.0.0.1:1106`**, y `PRIVATE_OBJECT_DIR`; adaptar a GCS con Application Default Credentials/servicio, S3 compatible o Supabase Storage. Mantener ACL owner/visibility, originales privados, variantes públicas, rutas y limpieza; no copiar solo SQL. |
| Clerk proxy ligado a dominio | `clerkProxyMiddleware` reenvía en producción `/api/__clerk` hacia Clerk usando secreto y forwarded host; usar configuración Clerk para dominio propio o proxy de identidad equivalente, sin hardcodear `.replit.app`. Mantener `clerkMiddleware` antes de rutas y autenticar servidor, no sustituir silenciosamente por otro modelo. |
| `BASE_PATH`, `$PORT`, proxy `/api`, `.replit`/artifact config | Vite espera base/port explícitos; en local usar `BASE_PATH=/`, puertos distintos para web/API y `API_TARGET`; proxy de Vite en desarrollo y reverse proxy del mismo origen en producción. Las llamadas UI bajo `/api/` requieren enrutamiento del mismo origen. |
| `pnpm-workspace.yaml` | catálogo incluye versiones `@replit/*`, `minimumReleaseAgeExclude` para scope Replit, `stripe-replit-sync` en allowlist aunque no es una dependencia Stripe del producto; quitar excepciones obsoletas tras retirar paquetes, preservar política de seguridad aplicable. |
| Pruebas E2E específicas del entorno | `VITE_E2E_MODE`, `NODE_ENV=test` y header de prueba; ejecutar aisladas, no activar en build productivo. |

No hay importaciones de `@replit/database` ni `@replit/extensions` en la aplicación actual. PostgreSQL y Clerk son servicios externos; los SDK `pg`, Drizzle y Clerk no requieren Replit por sí mismos. `@google-cloud/storage` es estándar; **su configuración de credenciales actual** sí está acoplada a Replit.

## 5. Entorno y reproducibilidad local

### 5.1 Inventario de variables y plantilla `.env.example` documentada

No se crea `.env.example` como archivo en esta tarea: el siguiente bloque es su **contenido recomendado**. Valores vacíos implican que el desarrollador debe configurar el servicio por su canal seguro; no son credenciales ni sirven para ejecutar funciones protegidas. No publicar un `.env` real. `VITE_` se incrusta en el bundle: solo publicar claves que Clerk designa públicas. Separar variables de web y API si se lanzan como procesos distintos.

```dotenv
# BASE DE DATOS: PostgreSQL externo; ejemplo de forma local sin usuario ni clave real.
DATABASE_URL=
# API Express: puerto de escucha obligatorio para el código actual.
PORT=3001
# Vite: establecer PORT=5173 solo al ejecutar el proceso web.
BASE_PATH=/
# Desarrollo Vite: destino del proxy /api; no usar localhost incrustado en el navegador.
API_TARGET=http://127.0.0.1:3001
# Clerk: clave publicable del frontend (no es un secreto).
VITE_CLERK_PUBLISHABLE_KEY=
# Proxy Clerk opcional, solo si se habilita y configura en el nuevo dominio.
VITE_CLERK_PROXY_URL=
# API: clave publicable usada por middleware Clerk y secreto guardado fuera del repositorio.
CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
# Lista de IDs externos autorizados a administrar, separada por comas; vacía por defecto.
ADMIN_CLERK_USER_IDS=
# Clave de firma HMAC de grants de carga; secreto largo fuera del repositorio.
SESSION_SECRET=
# Prefijo bucket/ruta del almacenamiento actual; debe adaptarse al proveedor externo.
PRIVATE_OBJECT_DIR=
# Entorno y logging; jamás activar test/E2E en producción.
NODE_ENV=development
LOG_LEVEL=info
VITE_E2E_MODE=false
# REPL_ID se consulta solo para cargar plugins propietarios: NO configurarlo fuera de Replit.
```

Lecturas reales adicionales: `import.meta.env.BASE_URL` y `import.meta.env.DEV` son variables incorporadas de Vite, no claves de `.env`; `PUBLIC_OBJECT_SEARCH_PATHS` y `DEFAULT_OBJECT_STORAGE_BUCKET_ID` pueden existir en un entorno Replit pero **no son leídas directamente por este código**. `REPLIT_DEV_DOMAIN`/`REPLIT_DOMAINS` tampoco son dependencias del runtime aquí. `JWT_SECRET` no existe: se usa `SESSION_SECRET` solo para grants HMAC de upload, Clerk gestiona identidad. `REPL_ID` es opcional para plugins de desarrollo actuales, no requisito del producto. El SDK del almacenamiento actual además requiere el sidecar y no funcionará fuera de Replit aun con `PRIVATE_OBJECT_DIR`. El ejemplo de URL local válida sería `postgresql://usuario:clave@127.0.0.1:5432/construmarket`, pero no almacenarla como valor por defecto con credenciales en el archivo versionado.

### 5.2 Scripts exactos actuales y secuencia portable

El proyecto **rechaza `npm install`** mediante `preinstall`, borra `package-lock.json`/`yarn.lock`, usa catálogo pnpm y `workspace:*`; por tanto los comandos solicitados como `npm run dev` o `npm run migrate` **no existen hoy**. Ejecutar con pnpm y Node compatible con las dependencias fijadas. Scripts actuales:

```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-spec run codegen
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/construmarket-cr run dev
pnpm --filter @workspace/construmarket-cr run build
pnpm run typecheck
pnpm run build
pnpm run validate:publish
```

`db:push` es `pnpm --filter @workspace/db run push` (`drizzle-kit push --config ./drizzle.config.ts`), no migración versionada; `push-force` existe pero puede destruir esquema/datos y **no** debe emplearse en producción. El build raíz es `pnpm run typecheck && pnpm -r --if-present run build`. El servidor `dev` hace `export NODE_ENV=development && pnpm run build && pnpm run start` (no hot reload); `start` ejecuta `node --enable-source-maps ./dist/index.mjs`. El web `dev` es `vite --config vite.config.ts --host 0.0.0.0`, `build` `vite build --config vite.config.ts`; ambos exigen `PORT` y `BASE_PATH`. `validate:publish` hace typecheck, build web con `PORT=4173 BASE_PATH=/` y test piloto navegador; este test puede ejecutar push de DB y requiere ambiente aislado, **no correr contra datos reales**. Los comandos de arriba requieren variables configuradas por proceso, por ejemplo API `PORT=3001` y web `PORT=5173 BASE_PATH=/ API_TARGET=http://127.0.0.1:3001`. No arrancar dos servicios con el mismo puerto.

**Adaptación propuesta para Cursor:** conservar pnpm/workspace, quitar plugins Replit; sustituir credenciales de objetos y configurar dominio Clerk; separar scripts `migrate` versionados después de generar y revisar SQL en vez de confiar en `push`; servir frontend compilado con un servidor estático y hacer reverse proxy `/api` a Express; mantener fallback SPA para rutas Wouter. Para usar npm habría que retirar la guarda `preinstall`, expandir catálogo/`workspace:*`, generar un lockfile npm y definir nuevos scripts: no es un simple cambio de comando. Para producción definir `NODE_ENV=production`, secretos por gestor del hosting, HTTPS, origen CORS permitido, estado de DB/objetos/backups y ejecutar migración antes de aceptar tráfico. Verificar GET `/api/healthz`, autenticación, carga/ACL y recorrido de moderación antes de cortar el DNS.

## 6. Código fuente íntegro de esquemas Drizzle

Transcripción literal de los seis archivos de `lib/db/src/schema/`; incluye barrel, las cinco definiciones y los tipos exportados. No hay `schema.prisma` ni un esquema monolítico. Los bloques siguientes son referencia de código **actual**, no una instrucción de ejecutarlos como SQL.

### `lib/db/src/schema/index.ts`
```ts
// Export your models here. Add one export per file
// export * from "./posts";
//
// Each model/table should ideally be split into different files.
// Each model/table should define a Drizzle table, insert schema, and types:
//
//   import { pgTable, text, serial } from "drizzle-orm/pg-core";
//   import { createInsertSchema } from "drizzle-zod";
//   import { z } from "zod/v4";
//
//   export const postsTable = pgTable("posts", {
//     id: serial("id").primaryKey(),
//     title: text("title").notNull(),
//   });
//
//   export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true });
//   export type InsertPost = z.infer<typeof insertPostSchema>;
//   export type Post = typeof postsTable.$inferSelect;

export * from "./validation-leads";
export * from "./users";
export * from "./professional-profiles";
export * from "./plans";
export * from "./plan-interests";
```

### `lib/db/src/schema/users.ts`
```ts
import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  role: text("role").notNull().default("buyer"),
  isSynthetic: boolean("is_synthetic").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
```

### `lib/db/src/schema/professional-profiles.ts`
```ts
import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const professionalProfilesTable = pgTable("professional_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id).unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  cfiaNumber: text("cfia_number").notNull().unique(),
  professionalType: text("professional_type").notNull(),
  province: text("province").notNull(),
  bio: text("bio").notNull(),
  status: text("status").notNull().default("pending"),
  isSynthetic: boolean("is_synthetic").notNull().default(false),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProfessionalProfileSchema = createInsertSchema(professionalProfilesTable).omit({ id: true, createdAt: true });
export type InsertProfessionalProfile = z.infer<typeof insertProfessionalProfileSchema>;
export type ProfessionalProfile = typeof professionalProfilesTable.$inferSelect;
```

### `lib/db/src/schema/plans.ts`
```ts
import { boolean, index, integer, jsonb, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { professionalProfilesTable } from "./professional-profiles";
import { usersTable } from "./users";

export const plansTable = pgTable("plans", {
  id: serial("id").primaryKey(),
  professionalId: integer("professional_id").notNull().references(() => professionalProfilesTable.id),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  type: text("type").notNull(),
  style: text("style").notNull(),
  m2: integer("m2").notNull(),
  bedrooms: integer("bedrooms").notNull(),
  bathrooms: integer("bathrooms").notNull(),
  floors: integer("floors").notNull(),
  priceUsd: numeric("price_usd", { precision: 10, scale: 2 }).notNull(),
  constructionMinUsd: numeric("construction_min_usd", { precision: 12, scale: 2 }).notNull(),
  constructionMaxUsd: numeric("construction_max_usd", { precision: 12, scale: 2 }).notNull(),
  province: text("province").notNull(),
  imageUrl: text("image_url").notNull(),
  images: jsonb("images").$type<Array<{
    originalPath: string;
    webPath: string;
    thumbnailPath: string;
    alt: string;
    focalX?: number;
    focalY?: number;
  }>>().notNull().default([]),
  status: text("status").notNull().default("draft"),
  isSynthetic: boolean("is_synthetic").notNull().default(false),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pendingPlanImageUploadsTable = pgTable("pending_plan_image_uploads", {
  objectPath: text("object_path").primaryKey(),
  ownerUserId: integer("owner_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  state: text("state").notNull().default("pending"),
  cleanupToken: text("cleanup_token"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("pending_plan_image_uploads_expires_at_idx").on(table.expiresAt),
]);

export const insertPlanSchema = createInsertSchema(plansTable).omit({ id: true, createdAt: true });
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plansTable.$inferSelect;
```

### `lib/db/src/schema/plan-interests.ts`
```ts
import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { plansTable } from "./plans";

export const planInterestsTable = pgTable("plan_interests", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => plansTable.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  province: text("province").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("new"),
  isSynthetic: boolean("is_synthetic").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPlanInterestSchema = createInsertSchema(planInterestsTable).omit({ id: true, createdAt: true });
export type InsertPlanInterest = z.infer<typeof insertPlanInterestSchema>;
export type PlanInterest = typeof planInterestsTable.$inferSelect;
```

### `lib/db/src/schema/validation-leads.ts`
```ts
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const validationLeadsTable = pgTable("validation_leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  province: text("province"),
  audience: text("audience").notNull(),
  cfiaNumber: text("cfia_number"),
  interest: text("interest"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertValidationLeadSchema = createInsertSchema(validationLeadsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertValidationLead = z.infer<typeof insertValidationLeadSchema>;
export type ValidationLead = typeof validationLeadsTable.$inferSelect;
```