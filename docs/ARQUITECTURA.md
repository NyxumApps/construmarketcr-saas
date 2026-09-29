# Arquitectura y decisiones de la migración

Fecha: 28 de septiembre de 2026. Base: `SPEC_MIGRACION_COMPLETA.md` y el código original del entorno Replit.

## Qué se conservó

La interfaz, las rutas, los tokens visuales, las reglas de moderación, la firma HMAC de cargas, la limpieza de imágenes con arrendamiento y el esquema de las seis tablas originales se mantienen como en el original. Las suites de regresión que venían con el proyecto siguen pasando.

## Qué se sustituyó

| Acoplamiento con Replit | Sustituto |
|---|---|
| Almacenamiento por sidecar `127.0.0.1:1106` | Supabase Storage (bucket privado `plan-images`); disco local en desarrollo |
| Metadato `custom:aclPolicy` en cada objeto | Tabla `stored_objects` en PostgreSQL |
| Proxy de Clerk ligado a `.replit.app` | Clerk directo con dominio propio |
| Plugins de Vite y SDK de conectores | Retirados |
| `drizzle-kit push` | Migraciones SQL versionadas en `supabase/migrations` |
| Laboratorio de maquetas | Retirado; no era parte del producto |

## Flujo de una imagen

```text
navegador ── solicita permiso ──▶ API firma {dueño, ruta, tamaño, tipo, vence}
navegador ── PUT bytes ─────────▶ API valida y guarda en Storage (privada)
                                  registra stored_objects + carga pendiente
navegador ── guarda plano ──────▶ una transacción: asocia cargas, valida con Sharp,
                                  publica variantes WebP, inserta el plano
visitante ── GET imagen ────────▶ API sirve solo si stored_objects dice "public"
```

En el original, publicar una imagen modificaba el almacenamiento fuera de la transacción SQL, y un fallo intermedio podía dejar imágenes públicas sin plano. Ahora la visibilidad es una fila de PostgreSQL y se confirma o se revierte junto con el plano.

## Compra y cotización

```text
comprador ─▶ POST /purchases ─▶ PaymentGateway.charge ─▶ compra "paid"
comprador ─▶ POST /purchases/:id/quote-requests
               │  copia la lista de materiales en la solicitud
               ├─▶ conector demo ────▶ cotización inmediata
               ├─▶ conector manual ──▶ "requested" ─▶ administración registra la respuesta
               └─▶ conector API ─────▶ (por integrar con cada ferretería)
comprador ─▶ GET /purchases/:id ─▶ comparación y cotización recomendada
```

- **Pasarela aislada.** `PaymentGateway` es la única frontera con el proveedor de pagos. Hoy solo existe `sandbox`, que no cobra y se identifica como modo de prueba en la interfaz.
- **Compra idempotente.** Hay una compra por comprador y diseño; repetir la solicitud devuelve la misma compra.
- **Proveedores independientes.** Cada conector tiene un límite de 12 segundos y nunca interrumpe a los demás: un proveedor caído produce una cotización fallida con un motivo legible.
- **Lista de materiales estimada.** Se calcula con proporciones por metro cuadrado (`lib/materials.ts`). Es orientativa y la interfaz lo indica.
- **Recomendación.** `lib/quoteRanking.ts` prefiere mayor cobertura, luego menor total, luego entrega más rápida.

## Contrato de errores

Toda respuesta de error tiene la misma forma:

```json
{
  "error": "Revise los siguientes datos: correo electrónico.",
  "code": "validation_failed",
  "requestId": "42",
  "fields": { "email": "Escriba un correo válido" }
}
```

`error` está en español y listo para mostrarse. `code` es estable para el cliente. `requestId` permite a soporte localizar el registro. Los errores no previstos responden 500 con un mensaje genérico; el detalle solo queda en el registro del servidor.

En la web, `describeError` convierte cualquier fallo en título, descripción y si conviene reintentar. Los reintentos automáticos se limitan a fallos de red y errores 5xx.

## Diferencias deliberadas con la especificación

| Especificación | Implementación | Motivo |
|---|---|---|
| 400 devuelve el detalle de Zod | 400 devuelve un mensaje en español y `fields` | El detalle de Zod es JSON técnico, ilegible para el usuario |
| CORS refleja cualquier origen | Solo orígenes de `ALLOWED_ORIGINS` | Adaptación que la propia especificación pide |
| URL de carga construida con el `Origin` recibido | Solo con un origen autorizado | Evita enlaces controlados por el cliente |
| Sin RLS | RLS activo sin políticas en todas las tablas | En Supabase el esquema `public` queda expuesto por la Data API |
| Sin índices en claves foráneas ni estado | Índices agregados | Adaptación opcional que sugiere la especificación |

## Discrepancias del original que siguen abiertas

- La interfaz del editor permite baños en incrementos de 0.5, pero la API exige enteros.
- La API no valida que la inversión mínima sea menor o igual que la máxima.
- La moderación no exige que el elemento esté pendiente antes de aprobarlo o rechazarlo.
- El límite de 30 cargas por 15 minutos vive en memoria y no se comparte entre réplicas.

Se dejaron como estaban para mantener la equivalencia. Su corrección está priorizada en [RECOMENDACIONES.md](RECOMENDACIONES.md).
