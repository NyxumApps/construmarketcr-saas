import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  useListPlans, 
  useCreateValidationLead, 
  useGetValidationSummary,
  ValidationLeadInputAudience 
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ChevronRight, ArrowRight, Building, Users, Ruler, BedDouble, Bath, MapPin, Calculator, BookOpenCheck } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Link, useLocation } from 'wouter';
import { useAppAuth } from '@/lib/app-auth';
import { useToast } from '@/hooks/use-toast';

import heroImage from '@assets/generated_images/hero-home.jpg';
import plan1Image from '@assets/generated_images/plan-1.jpg';
import plan2Image from '@assets/generated_images/plan-2.jpg';
import plan3Image from '@assets/generated_images/plan-3.jpg';

// Cost data context for Costa Rica (estimated USD per m2)
const FINISH_RATES = {
  standard: { min: 700, max: 950, label: 'Estándar' },
  premium: { min: 950, max: 1300, label: 'Premium' },
  luxury: { min: 1300, max: 2000, label: 'Lujo' }
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
};

const buyerSchema = z.object({
  name: z.string().min(2, 'Nombre es requerido'),
  email: z.string().email('Email inválido'),
  province: z.string().min(1, 'Provincia es requerida'),
  interest: z.string().optional(),
});

const professionalSchema = z.object({
  name: z.string().min(2, 'Nombre es requerido'),
  email: z.string().email('Email inválido'),
  phone: z.string().min(8, 'Teléfono es requerido'),
  cfiaNumber: z.string().min(1, 'Carné CFIA es requerido'),
});

export default function Home() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { isSignedIn } = useAppAuth();
  
  // API Hooks
  const { data: summary, isLoading: isLoadingSummary } = useGetValidationSummary();
  const { data: plans = [], isLoading: isLoadingPlans } = useListPlans();
  const createLead = useCreateValidationLead();

  // Local State
  const [m2, setM2] = useState<number[]>([150]);
  const [finish, setFinish] = useState<keyof typeof FINISH_RATES>('standard');
  const [activeTab, setActiveTab] = useState<string>('buyer');

  // Forms
  const buyerForm = useForm<z.infer<typeof buyerSchema>>({
    resolver: zodResolver(buyerSchema),
    defaultValues: { name: '', email: '', province: '', interest: '' }
  });

  const proForm = useForm<z.infer<typeof professionalSchema>>({
    resolver: zodResolver(professionalSchema),
    defaultValues: { name: '', email: '', phone: '', cfiaNumber: '' }
  });

  const onBuyerSubmit = (values: z.infer<typeof buyerSchema>) => {
    createLead.mutate({
      data: {
        audience: ValidationLeadInputAudience.buyer,
        ...values
      }
    }, {
      onSuccess: () => {
        toast({ title: '¡Registro exitoso!', description: 'Le notificaremos cuando la plataforma esté disponible.' });
        buyerForm.reset();
      },
      onError: () => {
        toast({ title: 'Error', description: 'Ocurrió un problema, intente de nuevo.', variant: 'destructive' });
      }
    });
  };

  const onProSubmit = (values: z.infer<typeof professionalSchema>) => {
    createLead.mutate({
      data: {
        audience: ValidationLeadInputAudience.professional,
        ...values
      }
    }, {
      onSuccess: () => {
        toast({ title: '¡Solicitud recibida!', description: 'Cree su cuenta para completar el perfil profesional.' });
        proForm.reset();
        setLocation('/sign-up?intent=professional');
      },
      onError: () => {
        toast({ title: 'Error', description: 'Ocurrió un problema, intente de nuevo.', variant: 'destructive' });
      }
    });
  };

  const estimatedMin = m2[0] * FINISH_RATES[finish].min;
  const estimatedMax = m2[0] * FINISH_RATES[finish].max;

  const handleScrollToPlans = () => {
    setLocation('/catalogo');
  };
  
  const handleScrollToForms = (tab: string) => {
    setLocation(tab === 'professional' ? '/sign-up?intent=professional' : '/catalogo');
  };

  const planImages = [plan1Image, plan2Image, plan3Image];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary/20 selection:text-primary">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 lg:pt-32 lg:pb-48 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/40 to-background z-10" />
          <img src={heroImage} alt="Arquitectura tropical moderna" className="w-full h-full object-cover object-center opacity-40" />
        </div>
        
        <div className="container relative z-20 mx-auto px-4 md:px-8 max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/10 text-secondary text-sm font-medium mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            Lanzamiento en Costa Rica
          </div>
          <h1 className="text-5xl md:text-7xl font-display font-bold text-foreground mb-6 leading-[1.1] tracking-tight animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100 fill-mode-both">
            Diseñe su futuro.<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Construya con certeza.</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 fill-mode-both">
            Descubra diseños listos para construir, estime costos reales y conecte con profesionales verificados por el CFIA para hacer su proyecto realidad.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300 fill-mode-both">
            <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg" onClick={handleScrollToPlans}>
              Explorar Catálogo <ChevronRight className="ml-2 w-5 h-5" />
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-lg bg-background/50 backdrop-blur-sm" onClick={() => handleScrollToForms('professional')}>
              Soy Profesional
            </Button>
          </div>
        </div>
      </section>

      {/* Validation Momentum */}
      <section className="border-y border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 md:px-8 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 divide-y md:divide-y-0 md:divide-x divide-border">
            <div className="flex flex-col items-center justify-center text-center pt-6 md:pt-0">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-4xl font-display font-bold text-foreground mb-1">
                {isLoadingSummary ? '-' : summary?.interestedBuyers || 0}
              </h3>
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">Compradores Listos</p>
            </div>
            <div className="flex flex-col items-center justify-center text-center pt-6 md:pt-0">
              <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mb-4">
                <BookOpenCheck className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="text-4xl font-display font-bold text-foreground mb-1">
                {isLoadingSummary ? '-' : summary?.interestedProfessionals || 0}
              </h3>
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">Profesionales Verificados</p>
            </div>
            <div className="flex flex-col items-center justify-center text-center pt-6 md:pt-0">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Building className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-4xl font-display font-bold text-foreground mb-1">
                {isLoadingSummary ? '-' : summary?.samplePlans || 0}
              </h3>
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">Diseños Disponibles</p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Estimator */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4 md:px-8 max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Proyecte su inversión</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              La construcción en Costa Rica varía según los acabados. Use nuestra calculadora para obtener rangos realistas basados en precios de mercado actuales.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-center bg-card rounded-3xl p-8 border shadow-xl shadow-black/5">
            <div className="space-y-10">
              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <Label className="text-base text-foreground flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-muted-foreground" />
                    Área de construcción
                  </Label>
                  <span className="text-2xl font-display font-semibold text-primary">{m2[0]} m²</span>
                </div>
                <Slider 
                  value={m2} 
                  onValueChange={setM2} 
                  max={500} 
                  min={40} 
                  step={5}
                  className="py-4"
                />
                <div className="flex justify-between text-xs text-muted-foreground font-medium">
                  <span>40 m²</span>
                  <span>500 m²</span>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-base text-foreground">Nivel de Acabados</Label>
                <div className="grid grid-cols-3 gap-3">
                  {(Object.keys(FINISH_RATES) as Array<keyof typeof FINISH_RATES>).map((key) => (
                    <div 
                      key={key}
                      onClick={() => setFinish(key)}
                      className={`cursor-pointer rounded-xl border-2 p-4 text-center transition-all ${finish === key ? 'border-secondary bg-secondary/5 shadow-sm' : 'border-border hover:border-border/80'}`}
                    >
                      <div className={`font-semibold mb-1 ${finish === key ? 'text-secondary' : 'text-foreground'}`}>
                        {FINISH_RATES[key].label}
                      </div>
                      <div className="text-xs text-muted-foreground font-medium">
                        ${FINISH_RATES[key].min}/m²
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-primary rounded-2xl p-8 text-primary-foreground flex flex-col justify-center h-full relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <Calculator className="w-32 h-32" />
              </div>
              <h4 className="text-primary-foreground/80 font-medium mb-2 z-10">Inversión Estimada</h4>
              <div className="space-y-2 z-10">
                <div className="text-4xl md:text-5xl font-display font-bold tracking-tight">
                  {formatCurrency(estimatedMin)}
                </div>
                <div className="text-primary-foreground/60 text-xl font-medium">
                  a {formatCurrency(estimatedMax)} USD
                </div>
              </div>
              <div className="mt-8 pt-8 border-t border-primary-foreground/10 z-10 text-sm text-primary-foreground/70">
                *Cálculo aproximado de obra gris y acabados. No incluye lote, permisos, ni honorarios profesionales (CFIA).
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Catalog Preview */}
      <section id="catalog" className="py-24">
        <div className="container mx-auto px-4 md:px-8">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Catálogo de Diseños</h2>
              <p className="text-lg text-muted-foreground">
                Descubra conceptos arquitectónicos adaptados al clima y topografía costarricense. Adquiera los planos constructivos listos para tramitar.
              </p>
            </div>
            <Button variant="outline" className="shrink-0" onClick={() => handleScrollToForms('buyer')}>
              Solicitar Catálogo Completo <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {isLoadingPlans ? (
              // Skeletons
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="overflow-hidden border-0 bg-muted/20 animate-pulse">
                  <div className="h-64 bg-muted/40 w-full" />
                  <CardContent className="p-6">
                    <div className="h-6 bg-muted/50 rounded w-2/3 mb-4" />
                    <div className="h-4 bg-muted/50 rounded w-full mb-2" />
                    <div className="h-4 bg-muted/50 rounded w-1/2" />
                  </CardContent>
                </Card>
              ))
            ) : plans.length > 0 ? (
              plans.slice(0, 3).map((plan, idx) => (
                <Card key={plan.id} className="overflow-hidden border group hover:shadow-xl transition-all duration-300">
                  <div className="h-64 relative overflow-hidden bg-muted">
                    <img 
                      src={planImages[idx % 3]} 
                      alt={plan.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                    />
                    <div className="absolute top-4 left-4 bg-background/90 backdrop-blur text-foreground px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
                      {plan.style}
                    </div>
                  </div>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-display text-xl font-bold text-foreground line-clamp-1">{plan.title}</h3>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b border-border/50">
                      <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-muted/30">
                        <Ruler className="w-5 h-5 text-muted-foreground mb-1" />
                        <span className="text-sm font-semibold">{plan.m2}m²</span>
                      </div>
                      <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-muted/30">
                        <BedDouble className="w-5 h-5 text-muted-foreground mb-1" />
                        <span className="text-sm font-semibold">{plan.bedrooms}</span>
                      </div>
                      <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-muted/30">
                        <Bath className="w-5 h-5 text-muted-foreground mb-1" />
                        <span className="text-sm font-semibold">{plan.bathrooms}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Construcción estimada:</p>
                      <p className="text-lg font-bold text-primary">
                        {formatCurrency(plan.constructionMinUsd)} - {formatCurrency(plan.constructionMaxUsd)}
                      </p>
                    </div>
                  </CardContent>
                  <CardFooter className="p-6 pt-0">
                    <Button className="w-full" variant="secondary" asChild>
                      <Link href={`/plan/${plan.id}`}>
                        Ver detalles
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))
            ) : (
              <div className="col-span-full text-center py-20 bg-muted/20 rounded-2xl">
                <p className="text-muted-foreground">No hay diseños disponibles en este momento.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Dual Conversion Section */}
      <section id="join" className="py-24 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay" />
        
        <div className="container mx-auto px-4 md:px-8 relative z-10 max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">Sea parte del futuro de la construcción</h2>
            <p className="text-xl text-primary-foreground/80">
              Únase a la lista de espera exclusiva. Estamos conectando a quienes quieren construir con los mejores diseños y profesionales del país.
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-8 bg-primary-foreground/10 p-1">
              <TabsTrigger value="buyer" className="data-[state=active]:bg-background data-[state=active]:text-primary">
                Quiero Construir
              </TabsTrigger>
              <TabsTrigger value="professional" className="data-[state=active]:bg-background data-[state=active]:text-primary">
                Soy Profesional
              </TabsTrigger>
            </TabsList>
            
            <div className="bg-background text-foreground rounded-2xl p-6 md:p-10 shadow-2xl">
              <TabsContent value="buyer" className="mt-0 outline-none">
                <div className="mb-6">
                  <h3 className="text-2xl font-display font-bold mb-2">Encuentre el diseño ideal</h3>
                  <p className="text-muted-foreground">Regístrese para ser el primero en acceder al catálogo completo y recibir asesoría.</p>
                </div>
                
                <form onSubmit={buyerForm.handleSubmit(onBuyerSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="buyer-name">Nombre completo</Label>
                      <Input id="buyer-name" placeholder="Ej. Carlos Rojas" {...buyerForm.register('name')} />
                      {buyerForm.formState.errors.name && <p className="text-sm text-destructive">{buyerForm.formState.errors.name.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="buyer-email">Correo electrónico</Label>
                      <Input id="buyer-email" type="email" placeholder="carlos@ejemplo.com" {...buyerForm.register('email')} />
                      {buyerForm.formState.errors.email && <p className="text-sm text-destructive">{buyerForm.formState.errors.email.message}</p>}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="buyer-province">Provincia de interés</Label>
                      <Select onValueChange={(val) => buyerForm.setValue('province', val)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione una provincia" />
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
                      {buyerForm.formState.errors.province && <p className="text-sm text-destructive">{buyerForm.formState.errors.province.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="buyer-interest">¿Qué tipo de proyecto busca?</Label>
                      <Select onValueChange={(val) => buyerForm.setValue('interest', val)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione un tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="casa-ciudad">Casa en ciudad</SelectItem>
                          <SelectItem value="casa-playa">Casa de playa</SelectItem>
                          <SelectItem value="cabana">Cabaña / Montaña</SelectItem>
                          <SelectItem value="inversion">Para inversión / Alquiler</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button type="submit" className="w-full mt-4 h-12 text-lg" disabled={createLead.isPending}>
                    {createLead.isPending ? 'Enviando...' : 'Unirse a la lista de espera'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="professional" className="mt-0 outline-none">
                <div className="mb-6">
                  <h3 className="text-2xl font-display font-bold mb-2">Publique sus diseños</h3>
                  <p className="text-muted-foreground">Monetice sus planos listos y conecte con clientes calificados en todo el país.</p>
                </div>
                
                <form onSubmit={proForm.handleSubmit(onProSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="pro-name">Nombre o Firma</Label>
                      <Input id="pro-name" placeholder="Arquitectos S.A." {...proForm.register('name')} />
                      {proForm.formState.errors.name && <p className="text-sm text-destructive">{proForm.formState.errors.name.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pro-cfia">Carné CFIA</Label>
                      <Input id="pro-cfia" placeholder="A-12345" {...proForm.register('cfiaNumber')} />
                      {proForm.formState.errors.cfiaNumber && <p className="text-sm text-destructive">{proForm.formState.errors.cfiaNumber.message}</p>}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="pro-email">Correo electrónico</Label>
                      <Input id="pro-email" type="email" placeholder="contacto@firma.com" {...proForm.register('email')} />
                      {proForm.formState.errors.email && <p className="text-sm text-destructive">{proForm.formState.errors.email.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pro-phone">Teléfono</Label>
                      <Input id="pro-phone" placeholder="8888-8888" {...proForm.register('phone')} />
                      {proForm.formState.errors.phone && <p className="text-sm text-destructive">{proForm.formState.errors.phone.message}</p>}
                    </div>
                  </div>

                  <Button type="submit" variant="secondary" className="w-full mt-4 h-12 text-lg" disabled={createLead.isPending}>
                    {createLead.isPending ? 'Validando...' : 'Aplicar como profesional'}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground mt-4">
                    Todos los profesionales deben estar colegiados activos en el Colegio Federado de Ingenieros y de Arquitectos de Costa Rica.
                  </p>
                </form>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </section>

      <Footer />
    </div>
  );
}
