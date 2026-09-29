import { useMemo, useState } from 'react';
import {
  useCreateQuoteRequest,
  useGetPurchase,
  useListSuppliers,
  type MaterialItem,
  type QuoteRequest,
  type SupplierQuote,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'wouter';
import { CheckCircle, ChevronLeft, Clock, Info, Truck, XCircle } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, ErrorState } from '@/components/feedback/StatusMessage';
import { useToast } from '@/hooks/use-toast';
import { useErrorToast } from '@/hooks/use-error-toast';
import { errorStatus, shouldRetry } from '@/lib/errors';
import { PROVINCES, formatCrc, formatDate, formatQuantity, formatUsd } from '@/lib/format';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary/20 selection:text-primary">
      <Navbar />
      <main className="flex-1 container mx-auto w-full min-w-0 px-4 md:px-8 py-12 max-w-5xl">
        <Link href="/portal/compras" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ChevronLeft className="w-4 h-4 mr-1" /> Volver a Mis Compras
        </Link>
        {children}
      </main>
      <Footer />
    </div>
  );
}

function MaterialsTable({ materials }: { materials: MaterialItem[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Material</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {materials.map((item) => (
            <TableRow key={item.code}>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell className="text-muted-foreground">{item.category}</TableCell>
              <TableCell className="text-right whitespace-nowrap">
                {formatQuantity(item.quantity)} {item.unit}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function QuoteCard({ quote, recommended }: { quote: SupplierQuote; recommended: boolean }) {
  return (
    <Card data-testid="supplier-quote" className={recommended ? 'border-secondary shadow-md' : ''}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg">{quote.supplierName}</CardTitle>
          {recommended && <Badge className="bg-secondary text-secondary-foreground">Recomendada</Badge>}
          {quote.supplierIsDemo && <Badge variant="outline">Demostración</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        {quote.status === 'received' && quote.totalCrc != null ? (
          <div className="space-y-3">
            <p className="text-3xl font-display font-bold text-primary">{formatCrc(quote.totalCrc)}</p>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Truck className="h-4 w-4" aria-hidden="true" />
                Entrega en {quote.deliveryDays} {quote.deliveryDays === 1 ? 'día' : 'días'}
              </p>
              <p className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" aria-hidden="true" />
                Cubre {quote.coveredItems} de {quote.totalItems} materiales
              </p>
              {quote.validUntil && (
                <p className="flex items-center gap-2">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  Precio válido hasta el {formatDate(quote.validUntil)}
                </p>
              )}
            </div>
            {quote.supplierIsDemo && (
              <p className="text-xs text-muted-foreground">
                Precios de ejemplo para mostrar el funcionamiento. No son una oferta real.
              </p>
            )}
          </div>
        ) : quote.status === 'requested' ? (
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <p>Solicitud enviada. Le avisaremos aquí cuando el proveedor responda.</p>
          </div>
        ) : (
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
            <p>{quote.failureReason ?? 'El proveedor no pudo cotizar esta solicitud.'}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuoteRequestSection({ request }: { request: QuoteRequest }) {
  return (
    <section className="space-y-4" data-testid="quote-request">
      <div>
        <h3 className="text-lg font-display font-bold text-foreground">
          Solicitud del {formatDate(request.createdAt)}
        </h3>
        <p className="text-sm text-muted-foreground">
          Entrega en {request.province}
          {request.notes ? ` · ${request.notes}` : ''}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {request.quotes.map((quote) => (
          <QuoteCard key={quote.id} quote={quote} recommended={quote.id === request.recommendedQuoteId} />
        ))}
      </div>
    </section>
  );
}

export default function PortalCompra() {
  const id = Number(useParams().id);
  const { toast } = useToast();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const queryKey = ['/api/purchases', id];

  const { data: purchase, isLoading, error, refetch, isRefetching } = useGetPurchase(id, {
    query: {
      enabled: Number.isInteger(id) && id > 0,
      queryKey,
      retry: shouldRetry,
      // Mientras un proveedor no responda, se consulta de nuevo sin recargar la página.
      refetchInterval: (query) =>
        query.state.data?.quoteRequests.some((request) =>
          request.quotes.some((quote) => quote.status === 'requested'),
        )
          ? 20_000
          : false,
    },
  });
  const suppliersQuery = useListSuppliers({ query: { queryKey: ['/api/suppliers'] } });
  const createQuoteRequest = useCreateQuoteRequest();

  const [province, setProvince] = useState<string>('');
  const [selected, setSelected] = useState<number[]>([]);
  const [notes, setNotes] = useState('');

  const availableSuppliers = useMemo(
    () => (suppliersQuery.data ?? []).filter((supplier) => !province || supplier.provinces.includes(province)),
    [suppliersQuery.data, province],
  );
  const chosen = selected.filter((supplierId) => availableSuppliers.some(({ id: available }) => available === supplierId));

  const toggleSupplier = (supplierId: number, checked: boolean) => {
    setSelected((current) =>
      checked ? [...new Set([...current, supplierId])] : current.filter((value) => value !== supplierId),
    );
  };

  const submit = () => {
    createQuoteRequest.mutate(
      { id, data: { province, supplierIds: chosen, notes: notes.trim() || undefined } },
      {
        onSuccess: (request) => {
          void queryClient.invalidateQueries({ queryKey });
          const received = request.quotes.filter((quote) => quote.status === 'received').length;
          toast({
            title: 'Solicitud enviada',
            description: received > 0
              ? `Ya tiene ${received} ${received === 1 ? 'cotización lista' : 'cotizaciones listas'} para comparar.`
              : 'Le mostraremos aquí las respuestas de los proveedores.',
          });
          setSelected([]);
          setNotes('');
        },
        onError: showError,
      },
    );
  };

  if (isLoading) {
    return (
      <Shell>
        <Skeleton className="h-10 w-2/3 mb-4" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </Shell>
    );
  }

  if (error || !purchase) {
    return (
      <Shell>
        {errorStatus(error) === 404 || !error ? (
          <EmptyState
            title="No encontramos esta compra"
            description="Revise que haya ingresado con la cuenta con la que compró el diseño."
            action={<Button asChild><Link href="/portal/compras">Ver mis compras</Link></Button>}
          />
        ) : (
          <ErrorState error={error} onRetry={() => void refetch()} isRetrying={isRefetching} />
        )}
      </Shell>
    );
  }

  const isPaid = purchase.status === 'paid';

  return (
    <Shell>
      <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div className="min-w-0">
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-2 text-foreground">{purchase.planTitle}</h1>
          <p className="text-muted-foreground text-lg">
            {formatUsd(purchase.amountUsd)} · {formatDate(purchase.paidAt ?? purchase.createdAt)}
          </p>
        </div>
        <Badge variant="outline" className={isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
          {isPaid ? 'Pagado' : 'Pago pendiente'}
        </Badge>
      </div>

      {purchase.testMode && (
        <div className="mb-8 flex items-start gap-3 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>Compra registrada en modo de prueba: no se realizó ningún cobro.</p>
        </div>
      )}

      <div className="space-y-10">
        <Card>
          <CardHeader>
            <CardTitle>Lista de materiales estimada</CardTitle>
            <CardDescription>
              Cantidades orientativas según el área y la distribución del diseño. El profesional a cargo de su obra define la lista definitiva.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MaterialsTable materials={purchase.materials} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Solicitar cotización</CardTitle>
            <CardDescription>Elija dónde construirá y a qué proveedores quiere consultar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isPaid ? (
              <p className="text-sm text-muted-foreground">Complete la compra del diseño para solicitar cotizaciones.</p>
            ) : suppliersQuery.error ? (
              <ErrorState
                error={suppliersQuery.error}
                onRetry={() => void suppliersQuery.refetch()}
                isRetrying={suppliersQuery.isRefetching}
              />
            ) : (
              <>
                <div className="space-y-2 max-w-xs">
                  <Label htmlFor="quote-province">Provincia de entrega</Label>
                  <Select value={province} onValueChange={setProvince}>
                    <SelectTrigger id="quote-province" data-testid="quote-province">
                      <SelectValue placeholder="Seleccione una provincia" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVINCES.map((name) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <fieldset className="space-y-3">
                  <legend className="text-sm font-medium text-foreground mb-2">Proveedores</legend>
                  {suppliersQuery.isLoading ? (
                    <Skeleton className="h-12 w-full" />
                  ) : !province ? (
                    <p className="text-sm text-muted-foreground">Seleccione una provincia para ver quién entrega en su zona.</p>
                  ) : availableSuppliers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Todavía no tenemos proveedores con entrega en {province}. Estamos sumando más ferreterías.
                    </p>
                  ) : (
                    availableSuppliers.map((supplier) => (
                      <div key={supplier.id} className="flex items-center gap-3 rounded-lg border p-3">
                        <Checkbox
                          id={`supplier-${supplier.id}`}
                          checked={chosen.includes(supplier.id)}
                          onCheckedChange={(checked) => toggleSupplier(supplier.id, checked === true)}
                        />
                        <Label htmlFor={`supplier-${supplier.id}`} className="flex flex-1 flex-wrap items-center gap-2 font-normal">
                          <span className="font-medium">{supplier.name}</span>
                          {supplier.isDemo && <Badge variant="outline">Demostración</Badge>}
                        </Label>
                      </div>
                    ))
                  )}
                </fieldset>

                <div className="space-y-2">
                  <Label htmlFor="quote-notes">Indicaciones para el proveedor (opcional)</Label>
                  <Textarea
                    id="quote-notes"
                    maxLength={500}
                    placeholder="Acceso al lote, fechas en que necesita el material..."
                    className="resize-none"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </div>

                <Button
                  className="h-12 w-full sm:w-auto"
                  disabled={!province || chosen.length === 0 || createQuoteRequest.isPending}
                  onClick={submit}
                  data-testid="request-quotes"
                >
                  {createQuoteRequest.isPending
                    ? 'Consultando proveedores…'
                    : chosen.length > 1
                      ? `Cotizar con ${chosen.length} proveedores`
                      : 'Solicitar cotización'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-8">
          <h2 className="text-2xl font-display font-bold">Cotizaciones</h2>
          {purchase.quoteRequests.length === 0 ? (
            <EmptyState
              title="Aún no ha solicitado cotizaciones"
              description="Cuando envíe una solicitud, aquí podrá comparar precio, plazo de entrega y cobertura de cada proveedor."
            />
          ) : (
            purchase.quoteRequests.map((request) => (
              <QuoteRequestSection key={request.id} request={request} />
            ))
          )}
        </div>
      </div>
    </Shell>
  );
}
