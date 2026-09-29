import React from 'react';
import { useParams } from 'wouter';
import { useGetPlan, useCreatePlanInterest } from '@workspace/api-client-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Ruler, BedDouble, Bath, Layers, MapPin, Building, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
};

const interestSchema = z.object({
  name: z.string().min(2, 'Nombre es requerido'),
  email: z.string().email('Email inválido'),
  phone: z.string().min(8, 'Teléfono es requerido'),
  province: z.string().min(1, 'Provincia es requerida'),
  message: z.string().min(5, 'El mensaje es muy corto'),
});

export default function PlanDetail() {
  const params = useParams();
  const id = Number(params.id);
  const { toast } = useToast();

  const {
    data: plan,
    error,
    isError,
    isLoading,
  } = useGetPlan(id, {
    query: {
      enabled: !!id,
      queryKey: ['/api/plans', id],
      retry: (failureCount, queryError) => queryError.status !== 404 && failureCount < 2,
    },
  });
  const createInterest = useCreatePlanInterest();

  const form = useForm<z.infer<typeof interestSchema>>({
    resolver: zodResolver(interestSchema),
    defaultValues: { name: '', email: '', phone: '', province: '', message: '' }
  });

  const onSubmit = (values: z.infer<typeof interestSchema>) => {
    if (!plan) return;
    createInterest.mutate({
      data: {
        planId: plan.id,
        ...values
      }
    }, {
      onSuccess: () => {
        toast({ title: '¡Solicitud enviada!', description: 'El profesional ha sido notificado y se contactará pronto.' });
        form.reset();
      },
      onError: () => {
        toast({ title: 'Error', description: 'No se pudo enviar la solicitud. Intente de nuevo.', variant: 'destructive' });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-12 animate-pulse">
          <div className="h-8 bg-muted w-1/3 mb-4 rounded"></div>
          <div className="h-[400px] bg-muted rounded-3xl mb-8"></div>
        </main>
        <Footer />
      </div>
    );
  }

  if ((isError && error.status === 404) || (!isError && !plan)) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-display font-bold mb-2">Diseño no encontrado</h1>
            <p className="text-muted-foreground">El plano que busca no existe o fue retirado.</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <h1 className="text-2xl font-display font-bold mb-2">No se pudo cargar el diseño</h1>
            <p className="text-muted-foreground">Intente de nuevo en unos momentos.</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary/20 selection:text-primary">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 md:px-8 py-12">
        <div className="grid lg:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <div className="flex gap-2 mb-4">
                <Badge className="bg-primary/10 text-primary hover:bg-primary/20">{plan.style}</Badge>
                <Badge variant="outline">{plan.type}</Badge>
              </div>
              <h1 className="text-4xl md:text-5xl font-display font-bold mb-4 text-foreground">{plan.title}</h1>
              <div className="flex items-center gap-2 text-muted-foreground mb-8 pb-8 border-b border-border/50">
                <ShieldCheck className="w-5 h-5 text-secondary" />
                <span>Diseñado por <strong>{plan.professionalName}</strong></span>
              </div>
            </div>

            <div className="rounded-3xl overflow-hidden bg-muted aspect-[16/9]">
              <img 
                src={plan.images[0] ? `/api/storage${plan.images[0].webPath}` : plan.imageUrl}
                alt={plan.images[0]?.alt || plan.title}
                className="w-full h-full object-cover"
                style={{ objectPosition: plan.images[0] ? `${plan.images[0].focalX}% ${plan.images[0].focalY}%` : undefined }}
                loading="eager"
                decoding="async"
              />
            </div>
            {plan.images.length > 1 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {plan.images.slice(1).map((image) => (
                  <div key={image.thumbnailPath} className="rounded-2xl overflow-hidden bg-muted aspect-[4/3]">
                    <img
                      src={`/api/storage${image.webPath}`}
                      alt={image.alt || plan.title}
                      className="w-full h-full object-cover"
                      style={{ objectPosition: `${image.focalX}% ${image.focalY}%` }}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-8 border-y border-border/50">
              <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-card border shadow-sm">
                <Ruler className="w-6 h-6 text-primary mb-2" />
                <span className="text-2xl font-bold font-display">{plan.m2}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">M²</span>
              </div>
              <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-card border shadow-sm">
                <BedDouble className="w-6 h-6 text-primary mb-2" />
                <span className="text-2xl font-bold font-display">{plan.bedrooms}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Cuartos</span>
              </div>
              <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-card border shadow-sm">
                <Bath className="w-6 h-6 text-primary mb-2" />
                <span className="text-2xl font-bold font-display">{plan.bathrooms}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Baños</span>
              </div>
              <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-card border shadow-sm">
                <Layers className="w-6 h-6 text-primary mb-2" />
                <span className="text-2xl font-bold font-display">{plan.floors}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Niveles</span>
              </div>
            </div>

            <div className="prose prose-lg dark:prose-invert max-w-none text-muted-foreground">
              <h2 className="text-2xl font-display font-bold text-foreground mb-4">Sobre el diseño</h2>
              <p className="whitespace-pre-line leading-relaxed">{plan.description}</p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              <div className="bg-primary text-primary-foreground rounded-2xl p-8 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-10">
                  <Building className="w-32 h-32" />
                </div>
                <h3 className="text-primary-foreground/80 font-medium mb-4 relative z-10">Inversión Estimada Construcción</h3>
                <div className="space-y-1 relative z-10">
                  <div className="text-3xl font-display font-bold">
                    {formatCurrency(plan.constructionMinUsd)}
                  </div>
                  <div className="text-primary-foreground/60 font-medium">
                    a {formatCurrency(plan.constructionMaxUsd)} USD
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-primary-foreground/10 relative z-10">
                  <h4 className="text-sm font-semibold mb-1 text-primary-foreground/90">Valor de los Planos</h4>
                  <p className="text-2xl font-display font-bold text-secondary">
                    {formatCurrency(plan.priceUsd)}
                  </p>
                </div>
              </div>

              <div className="bg-card rounded-2xl p-6 md:p-8 shadow-xl border">
                <h3 className="text-xl font-display font-bold mb-2">¿Le interesa este diseño?</h3>
                <p className="text-sm text-muted-foreground mb-6">Envíe sus datos para coordinar la compra de los planos directamente con el profesional.</p>
                
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre completo</Label>
                    <Input id="name" placeholder="Su nombre" {...form.register('name')} />
                    {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Correo electrónico</Label>
                    <Input id="email" type="email" placeholder="su@correo.com" {...form.register('email')} />
                    {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Teléfono</Label>
                      <Input id="phone" placeholder="8888-8888" {...form.register('phone')} />
                      {form.formState.errors.phone && <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="province">Dónde construirá</Label>
                      <Select onValueChange={(val) => form.setValue('province', val)}>
                        <SelectTrigger id="province">
                          <SelectValue placeholder="Provincia" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sanjose">San José</SelectItem>
                          <SelectItem value="alajuela">Alajuela</SelectItem>
                          <SelectItem value="cartago">Cartago</SelectItem>
                          <SelectItem value="heredia">Heredia</SelectItem>
                          <SelectItem value="guanacaste">Guanacaste</SelectItem>
                          <SelectItem value="puntarenas">Puntarenas</SelectItem>
                          <SelectItem value="limon">Limón</SelectItem>
                        </SelectContent>
                      </Select>
                      {form.formState.errors.province && <p className="text-xs text-destructive">{form.formState.errors.province.message}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Mensaje</Label>
                    <Textarea 
                      id="message" 
                      placeholder="Dudas sobre el lote, topografía o el diseño en general..." 
                      className="resize-none min-h-[100px]"
                      {...form.register('message')} 
                    />
                    {form.formState.errors.message && <p className="text-xs text-destructive">{form.formState.errors.message.message}</p>}
                  </div>

                  <Button type="submit" className="w-full h-12 text-lg" disabled={createInterest.isPending}>
                    {createInterest.isPending ? 'Enviando...' : 'Contactar Profesional'}
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
