import { useState } from 'react';
import {
  useCreateSupplier,
  useListAdminSuppliers,
  useUpdateSupplier,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { EmptyState, ErrorState } from '@/components/feedback/StatusMessage';
import { useToast } from '@/hooks/use-toast';
import { useErrorToast } from '@/hooks/use-error-toast';
import { applyFieldErrors } from '@/lib/errors';
import { PROVINCES } from '@/lib/format';

const supplierSchema = z.object({
  name: z.string().min(2, 'Escriba el nombre del proveedor'),
  contactEmail: z.string().email('Escriba un correo válido').or(z.literal('')),
  website: z.string().max(200, 'Máximo 200 caracteres'),
});

const QUERY_KEY = ['/api/admin/suppliers'];

export function SuppliersTab() {
  const { toast } = useToast();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const { data: suppliers = [], isLoading, error, refetch, isRefetching } = useListAdminSuppliers({
    query: { queryKey: QUERY_KEY },
  });
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const [provinces, setProvinces] = useState<string[]>([]);

  const form = useForm<z.infer<typeof supplierSchema>>({
    resolver: zodResolver(supplierSchema),
    defaultValues: { name: '', contactEmail: '', website: '' },
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ['/api/suppliers'] });
  };

  const onSubmit = (values: z.infer<typeof supplierSchema>) => {
    if (provinces.length === 0) {
      toast({ title: 'Seleccione al menos una provincia', variant: 'destructive' });
      return;
    }
    createSupplier.mutate({
      data: {
        name: values.name,
        connector: 'manual',
        provinces,
        contactEmail: values.contactEmail || undefined,
        website: values.website || undefined,
      },
    }, {
      onSuccess: () => {
        toast({ title: 'Proveedor agregado' });
        form.reset();
        setProvinces([]);
        refresh();
      },
      onError: (failure) => applyFieldErrors(form, showError(failure)),
    });
  };

  const setActive = (id: number, active: boolean) => {
    updateSupplier.mutate({ id, data: { active } }, {
      onSuccess: () => {
        toast({ title: active ? 'Proveedor activado' : 'Proveedor pausado' });
        refresh();
      },
      onError: showError,
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-display font-bold">Proveedores de materiales</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Agregar proveedor</CardTitle>
          <CardDescription>
            Las solicitudes llegan a la pestaña Cotizaciones para gestionarlas con la ferretería y registrar su respuesta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="supplier-name">Nombre</Label>
                <Input id="supplier-name" {...form.register('name')} />
                {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-email">Correo de cotizaciones</Label>
                <Input id="supplier-email" type="email" {...form.register('contactEmail')} />
                {form.formState.errors.contactEmail && <p className="text-xs text-destructive">{form.formState.errors.contactEmail.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-website">Sitio web</Label>
                <Input id="supplier-website" {...form.register('website')} />
                {form.formState.errors.website && <p className="text-xs text-destructive">{form.formState.errors.website.message}</p>}
              </div>
            </div>
            <fieldset>
              <legend className="text-sm font-medium mb-2">Provincias con entrega</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PROVINCES.map((name) => (
                  <div key={name} className="flex items-center gap-2">
                    <Checkbox
                      id={`province-${name}`}
                      checked={provinces.includes(name)}
                      onCheckedChange={(checked) =>
                        setProvinces((current) =>
                          checked === true ? [...current, name] : current.filter((value) => value !== name),
                        )
                      }
                    />
                    <Label htmlFor={`province-${name}`} className="font-normal">{name}</Label>
                  </div>
                ))}
              </div>
            </fieldset>
            <Button type="submit" disabled={createSupplier.isPending}>
              {createSupplier.isPending ? 'Guardando…' : 'Agregar proveedor'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <p>Cargando...</p>
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} isRetrying={isRefetching} />
      ) : suppliers.length === 0 ? (
        <EmptyState title="No hay proveedores" description="Agregue la primera ferretería para empezar a cotizar." />
      ) : (
        <div className="grid gap-4">
          {suppliers.map((supplier) => (
            <Card key={supplier.id} data-testid="supplier-card">
              <CardContent className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-lg font-bold">{supplier.name}</p>
                    {supplier.isDemo && <Badge variant="outline">Demostración</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground break-words">{supplier.provinces.join(' · ')}</p>
                  {supplier.contactEmail && <p className="text-sm text-muted-foreground break-all">{supplier.contactEmail}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id={`supplier-active-${supplier.id}`}
                    checked={supplier.active}
                    disabled={updateSupplier.isPending}
                    onCheckedChange={(checked) => setActive(supplier.id, checked)}
                  />
                  <Label htmlFor={`supplier-active-${supplier.id}`} className="font-normal">
                    {supplier.active ? 'Activo' : 'Pausado'}
                  </Label>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
