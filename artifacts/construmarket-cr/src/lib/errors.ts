import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';

export type FriendlyError = {
  title: string;
  description: string;
  /** Verdadero cuando repetir la misma acción puede funcionar. */
  retryable: boolean;
  /** Código que la persona puede compartir con soporte. */
  reference?: string;
  fields?: Record<string, string>;
};

type ApiErrorLike = {
  status: number;
  data: unknown;
};

function isApiError(error: unknown): error is ApiErrorLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as ApiErrorLike).status === 'number' &&
    'data' in error
  );
}

function readBody(data: unknown) {
  if (typeof data !== 'object' || data === null) return {};
  const body = data as Record<string, unknown>;
  return {
    message: typeof body.error === 'string' && body.error.trim() ? body.error : undefined,
    reference: typeof body.requestId === 'string' ? body.requestId : undefined,
    fields:
      typeof body.fields === 'object' && body.fields !== null
        ? (body.fields as Record<string, string>)
        : undefined,
  };
}

export function errorStatus(error: unknown): number | undefined {
  return isApiError(error) ? error.status : undefined;
}

export function describeError(error: unknown): FriendlyError {
  if (!isApiError(error)) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    return {
      title: offline ? 'Sin conexión a internet' : 'No pudimos conectarnos',
      description: offline
        ? 'Revise su conexión. Sus datos siguen aquí; intente de nuevo cuando vuelva la señal.'
        : 'El servicio no respondió. Espere un momento e intente de nuevo.',
      retryable: true,
    };
  }

  const { message, reference, fields } = readBody(error.data);
  const { status } = error;

  if (status === 401) {
    return {
      title: 'Su sesión terminó',
      description: 'Inicie sesión de nuevo para continuar donde quedó.',
      retryable: false,
    };
  }
  if (status === 403) {
    return {
      title: 'No tiene acceso a esta sección',
      description: message ?? 'Su cuenta no tiene permiso para realizar esta acción.',
      retryable: false,
    };
  }
  if (status === 404) {
    return {
      title: 'No lo encontramos',
      description: message ?? 'Es posible que se haya movido o ya no esté disponible.',
      retryable: false,
    };
  }
  if (status === 402) {
    return {
      title: 'No se completó el pago',
      description: message ?? 'No se realizó ningún cobro. Puede intentarlo de nuevo.',
      retryable: true,
    };
  }
  if (status === 429) {
    return {
      title: 'Demasiados intentos',
      description: message ?? 'Espere unos minutos antes de intentarlo de nuevo.',
      retryable: true,
    };
  }
  if (status >= 500) {
    return {
      title: 'Tuvimos un problema de nuestro lado',
      description: 'No es por algo que usted hizo. Intente de nuevo en unos minutos.',
      retryable: true,
      reference,
    };
  }
  return {
    title: status === 409 ? 'No se pudo completar' : 'Revise la información',
    description: message ?? 'Revise los datos e intente de nuevo.',
    retryable: false,
    fields,
  };
}

/** Reintenta solo lo que puede resolverse solo: red caída o fallo del servidor. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  const status = errorStatus(error);
  if (status !== undefined && status < 500) return false;
  return failureCount < 2;
}

/** Muestra junto a cada campo los errores que devolvió el servidor. */
export function applyFieldErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
  error: FriendlyError,
): void {
  if (!error.fields) return;
  const known = form.getValues();
  for (const [field, message] of Object.entries(error.fields)) {
    if (field in known) {
      form.setError(field as Path<T>, { type: 'server', message });
    }
  }
}
