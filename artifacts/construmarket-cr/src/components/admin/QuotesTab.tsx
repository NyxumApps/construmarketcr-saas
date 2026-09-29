import { useState } from 'react';
import {
  useListAdminQuotes,
  useRecordQuoteResponse,
  type AdminQuote,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState, ErrorState } from '@/components/feedback/StatusMessage';
import { useToast } from '@/hooks/use-toast';
import { useErrorToast } from '@/hooks/use-error-toast';
import { formatDate, formatQuantity } from '@/lib/format';

const QUERY_KEY = ['/api/admin/quotes'];

function PendingQuote({ quote }: { quote: AdminQuote }) {
  const { toast } = useToast();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const recordResponse = useRecordQuoteResponse();
  const [total, setTotal] = useState('');
  const [days, setDays] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const onSettled = {
    onSuccess: () => {
      toast({ title: 'Respuesta registrada', description: 'El comprador ya puede verla en su compra.' });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (failure: unknown) => setFieldErrors(showError(failure).fields ?? {}),
  };

  const saveReceived = () => {
    const totalCrc = Number(total);
    const deliveryDays = Number(days);
    const errors: Record<string, string> = {};
    if (!total || !Number.isFinite(totalCrc) || totalCrc < 1) errors.totalCrc = 'Escriba el monto total en colones';
    if (days === '' || !Number.isInteger(deliveryDays) || deliveryDays < 0) errors.deliveryDays = 'Escriba los días de entrega';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    recordResponse.mutate({ id: quote.id, data: { status: 'received', totalCrc, deliveryDays } }, onSettled);
  };

  const saveFailed = () => {
    recordResponse.mutate({ id: quote.id, data: { status: 'failed' } }, onSettled);
  };

  return (
    <Card data-testid="admin-quote-card" className="border-amber-200 bg-amber-50/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{quote.supplierName}</CardTitle>
        <CardDescription className="break-words">
          {quote.planTitle} · entrega en {quote.province} · solicitada el {formatDate(quote.requestedAt)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground space-y-1">
          {quote.supplierContactEmail && <p className="break-all"><strong>Contacto:</strong> {quote.supplierContactEmail}</p>}
          {quote.notes && <p><strong>Indicaciones:</strong> {quote.notes}</p>}
        </div>
        <details className="rounded-xl bg-muted p-4 text-sm">
          <summary className="cursor-pointer font-semibold text-foreground">
            Materiales solicitados ({quote.items.length})
          </summary>
          <ul className="mt-3 space-y-1 text-muted-foreground">
            {quote.items.map((item) => (
              <li key={item.code}>{formatQuantity(item.quantity)} {item.unit} · {item.name}</li>
            ))}
          </ul>
        </details>
        <div className="bg-muted p-4 rounded-xl space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`quote-total-${quote.id}`}>Total cotizado (₡)</Label>
              <Input
                id={`quote-total-${quote.id}`}
                inputMode="numeric"
                value={total}
                onChange={(event) => setTotal(event.target.value)}
              />
              {fieldErrors.totalCrc && <p className="text-xs text-destructive">{fieldErrors.totalCrc}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`quote-days-${quote.id}`}>Días de entrega</Label>
              <Input
                id={`quote-days-${quote.id}`}
                inputMode="numeric"
                value={days}
                onChange={(event) => setDays(event.target.value)}
              />
              {fieldErrors.deliveryDays && <p className="text-xs text-destructive">{fieldErrors.deliveryDays}</p>}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={saveReceived} disabled={recordResponse.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCircle className="w-4 h-4 mr-2" /> Registrar cotización
            </Button>
            <Button onClick={saveFailed} disabled={recordResponse.isPending} variant="destructive">
              <XCircle className="w-4 h-4 mr-2" /> El proveedor no cotizó
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function QuotesTab({ active }: { active: boolean }) {
  const { data: quotes = [], isLoading, error, refetch, isRefetching } = useListAdminQuotes({
    query: { queryKey: QUERY_KEY, refetchInterval: active ? 15_000 : false },
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-display font-bold">Cotizaciones por responder</h2>
      {isLoading ? (
        <p>Cargando...</p>
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} isRetrying={isRefetching} />
      ) : quotes.length === 0 ? (
        <EmptyState
          title="No hay cotizaciones pendientes"
          description="Las solicitudes a proveedores sin conexión automática aparecerán aquí."
        />
      ) : (
        <div className="grid gap-6">
          {quotes.map((quote) => <PendingQuote key={quote.id} quote={quote} />)}
        </div>
      )}
    </div>
  );
}
