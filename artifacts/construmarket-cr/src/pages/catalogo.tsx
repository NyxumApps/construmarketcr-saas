import React, { useState } from 'react';
import { useListPlans } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Ruler, BedDouble, Bath } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
};

export default function Catalogo() {
  const [searchTerm, setSearchTerm] = useState('');
  const [styleFilter, setStyleFilter] = useState<string>('all');
  const [provinceFilter, setProvinceFilter] = useState<string>('all');
  
  const { data: plans = [], isLoading } = useListPlans({
    style: styleFilter !== 'all' ? styleFilter : undefined,
  });

  const filteredPlans = plans.filter(plan => {
    if (plan.status !== 'published') return false;
    if (searchTerm && !plan.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (provinceFilter !== 'all' && plan.province !== provinceFilter) return false;
    return true;
  });

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary/20 selection:text-primary">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 md:px-8 py-12">
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">Catálogo de Diseños</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Explore nuestra colección de planos listos para construir. Diseños optimizados para Costa Rica, revisados por profesionales verificados.
          </p>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 bg-card p-4 rounded-2xl border shadow-sm">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nombre..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
          <Select value={styleFilter} onValueChange={setStyleFilter}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Estilo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estilos</SelectItem>
              <SelectItem value="tropical">Tropical Moderno</SelectItem>
              <SelectItem value="minimalista">Minimalista</SelectItem>
              <SelectItem value="colonial">Colonial</SelectItem>
              <SelectItem value="rustico">Rústico</SelectItem>
            </SelectContent>
          </Select>
          <Select value={provinceFilter} onValueChange={setProvinceFilter}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Provincia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las provincias</SelectItem>
              <SelectItem value="sanjose">San José</SelectItem>
              <SelectItem value="alajuela">Alajuela</SelectItem>
              <SelectItem value="cartago">Cartago</SelectItem>
              <SelectItem value="heredia">Heredia</SelectItem>
              <SelectItem value="guanacaste">Guanacaste</SelectItem>
              <SelectItem value="puntarenas">Puntarenas</SelectItem>
              <SelectItem value="limon">Limón</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="overflow-hidden border-0 bg-muted/20 animate-pulse">
                <div className="h-64 bg-muted/40 w-full" />
                <CardContent className="p-6">
                  <div className="h-6 bg-muted/50 rounded w-2/3 mb-4" />
                  <div className="h-4 bg-muted/50 rounded w-full mb-2" />
                  <div className="h-4 bg-muted/50 rounded w-1/2" />
                </CardContent>
              </Card>
            ))
          ) : filteredPlans.length > 0 ? (
            filteredPlans.map((plan) => (
              <Card key={plan.id} data-testid="public-plan-card" className="overflow-hidden border group hover:shadow-xl transition-all duration-300 flex flex-col">
                <div className="h-64 relative overflow-hidden bg-muted">
                  <img 
                    src={plan.images[0] ? `/api/storage${plan.images[0].webPath}` : plan.imageUrl || `https://picsum.photos/seed/${plan.id}/600/400`}
                    alt={plan.images[0]?.alt || plan.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                    style={{ objectPosition: plan.images[0] ? `${plan.images[0].focalX}% ${plan.images[0].focalY}%` : undefined }}
                  />
                  <div className="absolute top-4 left-4 flex gap-2">
                    <Badge variant="secondary" className="bg-background/90 backdrop-blur text-foreground uppercase tracking-wider font-semibold">
                      {plan.style}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-6 flex-1">
                  <div className="mb-4">
                    <h3 className="font-display text-xl font-bold text-foreground line-clamp-1 mb-1">{plan.title}</h3>
                    <p className="text-sm text-muted-foreground">Por {plan.professionalName}</p>
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
                <CardFooter className="p-6 pt-0 mt-auto">
                  <Button className="w-full" asChild>
                    <Link href={`/plan/${plan.id}`}>Ver Detalles del Diseño</Link>
                  </Button>
                </CardFooter>
              </Card>
            ))
          ) : (
            <div className="col-span-full text-center py-20 bg-muted/20 rounded-2xl border border-dashed">
              <p className="text-muted-foreground mb-2">No se encontraron diseños con estos filtros.</p>
              <Button variant="link" onClick={() => { setSearchTerm(''); setStyleFilter('all'); setProvinceFilter('all'); }}>
                Limpiar filtros
              </Button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
