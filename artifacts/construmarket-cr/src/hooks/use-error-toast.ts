import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { describeError, type FriendlyError } from '@/lib/errors';

/** Convierte cualquier fallo en un aviso claro y devuelve su descripción. */
export function useErrorToast() {
  const { toast } = useToast();

  return useCallback(
    (error: unknown): FriendlyError => {
      const friendly = describeError(error);
      toast({
        title: friendly.title,
        description: friendly.reference
          ? `${friendly.description} Referencia: ${friendly.reference}`
          : friendly.description,
        variant: 'destructive',
      });
      return friendly;
    },
    [toast],
  );
}
