import React, { useEffect, useRef, useState } from 'react';
import { 
  useGetAdminSummary, 
  useListAdminProfessionals, 
  useReviewProfessional, 
  useListAdminPlans, 
  useReviewPlan, 
  useListAdminInterests,
  useGetMe
} from '@workspace/api-client-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Users, Building, ShieldCheck, FileText, CheckCircle, XCircle } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { SuppliersTab } from '@/components/admin/SuppliersTab';
import { QuotesTab } from '@/components/admin/QuotesTab';

export default function AdminDashboard() {
  const { toast } = useToast();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const { data: me } = useGetMe();
  const [activeTab, setActiveTab] = useState('summary');
  const [newLeadCount, setNewLeadCount] = useState(0);
  const lastSeenLeadCount = useRef<number | null>(null);
  
  const { data: summary, refetch: refetchSummary } = useGetAdminSummary({
    query: {
      queryKey: ['/api/admin/summary'],
      refetchInterval: 15_000
    }
  });
  const { data: professionals = [], isLoading: proLoading } = useListAdminProfessionals();
  const { data: plans = [], isLoading: planLoading } = useListAdminPlans();
  const { data: interests = [], isLoading: intLoading, refetch: refetchInterests } = useListAdminInterests({
    query: {
      queryKey: ['/api/admin/interests'],
      refetchInterval: activeTab === 'interests' ? 15_000 : false
    }
  });

  const reviewPro = useReviewProfessional();
  const reviewPlan = useReviewPlan();

  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});

  useEffect(() => {
    const totalLeads = summary?.totalInterests;

    if (totalLeads === undefined) return;

    if (lastSeenLeadCount.current === null || activeTab === 'interests') {
      lastSeenLeadCount.current = totalLeads;
      setNewLeadCount(0);
      return;
    }

    setNewLeadCount(Math.max(0, totalLeads - lastSeenLeadCount.current));
  }, [activeTab, summary?.totalInterests]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);

    if (tab === 'interests') {
      if (summary?.totalInterests !== undefined) {
        lastSeenLeadCount.current = summary.totalInterests;
      }
      setNewLeadCount(0);
      void Promise.all([refetchInterests(), refetchSummary()]);
    }
  };

  const handleReviewPro = (id: number, status: 'approved' | 'rejected') => {
    reviewPro.mutate({ id, data: { status, notes: reviewNotes[id] } }, {
      onSuccess: () => {
        toast({ title: 'Profesional actualizado' });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/professionals'] });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/summary'] });
      },
      onError: showError,
    });
  };

  const handleReviewPlan = (id: number, status: 'published' | 'rejected') => {
    reviewPlan.mutate({ id, data: { status, notes: reviewNotes[id] } }, {
      onSuccess: () => {
        toast({ title: 'Plano actualizado' });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/plans'] });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/summary'] });
      },
      onError: showError,
    });
  };

  if (me?.role !== 'admin') {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <p>Acceso denegado.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary/20 selection:text-primary">
      <Navbar />
      
      <main className="flex-1 container mx-auto w-full min-w-0 overflow-x-hidden px-4 md:px-8 py-12 max-w-6xl">
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">Dashboard Admin</h1>
          <p className="text-muted-foreground text-lg">Moderación y métricas de la plataforma</p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full min-w-0">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 mb-8 bg-muted/50 p-1 rounded-xl sm:grid-cols-3 lg:grid-cols-6">
            <TabsTrigger value="summary" className="min-w-0 whitespace-normal px-2 py-2 text-xs sm:text-sm">Resumen</TabsTrigger>
            <TabsTrigger value="professionals" className="min-w-0 whitespace-normal px-2 py-2 text-xs sm:text-sm">
              Profesionales {summary?.pendingProfessionals ? `(${summary.pendingProfessionals})` : ''}
            </TabsTrigger>
            <TabsTrigger value="plans" className="min-w-0 whitespace-normal px-2 py-2 text-xs sm:text-sm">
              Diseños {summary?.pendingPlans ? `(${summary.pendingPlans})` : ''}
            </TabsTrigger>
            <TabsTrigger value="interests" className="min-w-0 gap-1 whitespace-normal px-2 py-2 text-xs sm:gap-2 sm:text-sm">
              Leads
              {newLeadCount > 0 && (
                <Badge variant="destructive" className="min-w-5 h-5 px-1.5 justify-center rounded-full">
                  {newLeadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="min-w-0 whitespace-normal px-2 py-2 text-xs sm:text-sm">Proveedores</TabsTrigger>
            <TabsTrigger value="quotes" className="min-w-0 whitespace-normal px-2 py-2 text-xs sm:text-sm">Cotizaciones</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    <Users className="w-4 h-4" /> Profesionales Pendientes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-display font-bold text-amber-600">{summary?.pendingProfessionals || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Diseños Pendientes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-display font-bold text-amber-600">{summary?.pendingPlans || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    <Building className="w-4 h-4" /> Diseños Publicados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-display font-bold text-emerald-600">{summary?.publishedPlans || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" /> Total Leads
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-display font-bold text-primary">{summary?.totalInterests || 0}</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="professionals" className="space-y-6">
            <h2 className="text-2xl font-display font-bold">Solicitudes de Profesionales</h2>
            {proLoading ? <p>Cargando...</p> : professionals.length === 0 ? <p className="text-muted-foreground">No hay profesionales registrados.</p> : (
              <div className="grid gap-6">
                {professionals.map(pro => (
                  <Card key={pro.id} data-testid="professional-card" className={pro.status === 'pending' ? 'border-amber-200 bg-amber-50/10' : ''}>
                    <CardHeader className="pb-2 flex flex-col items-start justify-between gap-3 sm:flex-row">
                      <div className="min-w-0">
                        <CardTitle className="text-xl">{pro.name}</CardTitle>
                        <CardDescription className="break-words">Carné CFIA: {pro.cfiaNumber} • {pro.professionalType}</CardDescription>
                      </div>
                      <Badge variant="outline" className={`
                        ${pro.status === 'pending' ? 'bg-amber-100 text-amber-800' : ''}
                        ${pro.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : ''}
                        ${pro.status === 'rejected' ? 'bg-red-100 text-red-800' : ''}
                      `}>{pro.status}</Badge>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground mb-4 space-y-1">
                        <p className="break-all"><strong>Email:</strong> {pro.email}</p>
                        <p><strong>Teléfono:</strong> {pro.phone}</p>
                        <p><strong>Provincia:</strong> {pro.province}</p>
                        <p><strong>Bio:</strong> {pro.bio}</p>
                      </div>
                      
                      {pro.status === 'pending' && (
                        <div className="bg-muted p-4 rounded-xl space-y-4">
                          <Textarea 
                            placeholder="Notas de revisión (opcional)..." 
                            value={reviewNotes[pro.id] || ''}
                            onChange={(e) => setReviewNotes({ ...reviewNotes, [pro.id]: e.target.value })}
                          />
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Button onClick={() => handleReviewPro(pro.id, 'approved')} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                              <CheckCircle className="w-4 h-4 mr-2" /> Aprobar CFIA
                            </Button>
                            <Button onClick={() => handleReviewPro(pro.id, 'rejected')} variant="destructive">
                              <XCircle className="w-4 h-4 mr-2" /> Rechazar
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="plans" className="space-y-6">
            <h2 className="text-2xl font-display font-bold">Moderación de Diseños</h2>
            {planLoading ? <p>Cargando...</p> : plans.length === 0 ? <p className="text-muted-foreground">No hay diseños enviados.</p> : (
              <div className="grid gap-6">
                {plans.map(plan => (
                  <Card key={plan.id} data-testid="admin-plan-card" className={plan.status === 'pending' ? 'border-amber-200 bg-amber-50/10' : ''}>
                    <div className="flex flex-col md:flex-row gap-6 p-6">
                      <div className="w-full md:w-64 shrink-0 rounded-xl overflow-hidden bg-muted h-48">
                        <img src={plan.imageUrl || `https://picsum.photos/seed/${plan.id}/600/400`} alt={plan.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1 flex flex-col">
                        <div className="flex flex-col justify-between items-start gap-3 mb-2 sm:flex-row">
                          <div className="min-w-0">
                            <h3 className="text-xl font-bold font-display">{plan.title}</h3>
                            <p className="text-sm text-muted-foreground">Por {plan.professionalName}</p>
                          </div>
                          <Badge variant="outline" className={`
                            ${plan.status === 'pending' ? 'bg-amber-100 text-amber-800' : ''}
                            ${plan.status === 'published' ? 'bg-emerald-100 text-emerald-800' : ''}
                            ${plan.status === 'rejected' ? 'bg-red-100 text-red-800' : ''}
                          `}>{plan.status}</Badge>
                        </div>
                        <p className="text-sm mb-4 line-clamp-2">{plan.description}</p>
                        
                        {plan.status === 'pending' && (
                          <div className="mt-auto bg-muted p-4 rounded-xl space-y-4">
                            <Textarea 
                              placeholder="Motivo de rechazo o nota (opcional)..." 
                              value={reviewNotes[plan.id] || ''}
                              onChange={(e) => setReviewNotes({ ...reviewNotes, [plan.id]: e.target.value })}
                            />
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <Button onClick={() => handleReviewPlan(plan.id, 'published')} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                <CheckCircle className="w-4 h-4 mr-2" /> Aprobar y Publicar
                              </Button>
                              <Button onClick={() => handleReviewPlan(plan.id, 'rejected')} variant="destructive">
                                <XCircle className="w-4 h-4 mr-2" /> Rechazar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="interests" className="space-y-6">
            <h2 className="text-2xl font-display font-bold">Leads de Compradores</h2>
            {intLoading ? <p>Cargando...</p> : interests.length === 0 ? <p className="text-muted-foreground">No hay leads registrados.</p> : (
              <div className="grid gap-6">
                {interests.map(lead => (
                  <Card key={lead.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Interés en: {lead.planTitle}</CardTitle>
                      <CardDescription>{new Date(lead.createdAt).toLocaleDateString()}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm space-y-1 text-muted-foreground">
                        <p><strong>Comprador:</strong> {lead.name}</p>
                        <p className="break-all"><strong>Contacto:</strong> {lead.email} | {lead.phone}</p>
                        <p><strong>Provincia:</strong> {lead.province}</p>
                        <div className="mt-4 p-4 bg-muted rounded-xl">
                          <p className="font-semibold text-foreground mb-1">Mensaje:</p>
                          <p>{lead.message}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="suppliers">
            <SuppliersTab />
          </TabsContent>

          <TabsContent value="quotes">
            <QuotesTab active={activeTab === 'quotes'} />
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
}
