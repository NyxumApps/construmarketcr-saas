import { useListMyPurchases } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { ChevronLeft } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/feedback/StatusMessage';
import { formatDate, formatUsd } from '@/lib/format';

export default function PortalCompras() {
  const { data: purchases = [], isLoading, error, refetch, isRefetching } = useListMyPurchases({
    query: { queryKey: ['/api/purchases'] },
  });

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary/20 selection:text-primary">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 md:px-8 py-12 max-w-4xl">
        <Link href="/portal" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ChevronLeft className="w-4 h-4 mr-1" /> Volver a Mi Portal
        </Link>
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-2 text-foreground">Mis Compras</h1>
          <p className="text-muted-foreground text-lg">Sus diseños y las cotizaciones de materiales</p>
        </div>

        {isLoading ? (
          <div className="grid gap-6">
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} className="h-36 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refetch()} isRetrying={isRefetching} />
        ) : purchases.length === 0 ? (
          <EmptyState
            title="Todavía no ha comprado diseños"
            description="Cuando compre un diseño aparecerá aquí, listo para cotizar sus materiales."
            action={
              <Button asChild>
                <Link href="/catalogo">Explorar el catálogo</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-6">
            {purchases.map((purchase) => (
              <Card key={purchase.id} data-testid="purchase-card" className="overflow-hidden">
                <div className="flex flex-col sm:flex-row">
                  <div className="h-40 w-full shrink-0 bg-muted sm:h-auto sm:w-56">
                    <img
                      src={purchase.planImageUrl}
                      alt={purchase.planTitle}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-4 p-6">
                    <div className="flex flex-col items-start justify-between gap-2 sm:flex-row">
                      <div className="min-w-0">
                        <h2 className="font-display text-xl font-bold text-foreground">{purchase.planTitle}</h2>
                        <p className="text-sm text-muted-foreground">
                          Comprado el {formatDate(purchase.paidAt ?? purchase.createdAt)}
                        </p>
                      </div>
                      <Badge variant="outline" className={purchase.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
                        {purchase.status === 'paid' ? 'Pagado' : 'Pago pendiente'}
                      </Badge>
                    </div>
                    <div className="mt-auto flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                      <p className="text-lg font-bold text-primary">{formatUsd(purchase.amountUsd)}</p>
                      <Button asChild>
                        <Link href={`/portal/compras/${purchase.id}`}>Cotizar materiales</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
