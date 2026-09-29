import React, { useEffect } from 'react';
import { useGetMe, useGetProfessionalProfile } from '@workspace/api-client-react';
import { useLocation, Link } from 'wouter';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAppClerk } from '@/lib/app-auth';
import { Building, BookOpenCheck, Settings, Home as HomeIcon } from 'lucide-react';

export default function PortalIndex() {
  const [, setLocation] = useLocation();
  const { signOut } = useAppClerk();
  
  const { data: me, isLoading: meLoading } = useGetMe();
  const { data: profile, isLoading: profileLoading } = useGetProfessionalProfile();

  const isLoading = meLoading || profileLoading;

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-12 flex justify-center items-center">
          <div className="w-8 h-8 rounded-full bg-primary/20 animate-pulse"></div>
        </main>
      </div>
    );
  }

  if (!me) {
    return null; // Should be handled by route guards or Clerk
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary/20 selection:text-primary">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 md:px-8 py-12 max-w-4xl">
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-2 text-foreground">Mi Portal</h1>
          <p className="text-muted-foreground text-lg">Bienvenido a ConstruMarket CR</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {me.role === 'admin' && (
            <Card className="border-secondary/20 shadow-md">
              <CardHeader className="bg-secondary/5 rounded-t-xl pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-secondary" />
                  Panel de Administración
                </CardTitle>
                <CardDescription>Gestión de plataforma y moderación</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-6">Acceda al panel de control para revisar profesionales, aprobar diseños y ver métricas generales.</p>
                <Button className="w-full" asChild>
                  <Link href="/admin">Ir al Dashboard Admin</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {me.role === 'professional' && (
            <>
              <Card className="border shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <BookOpenCheck className="w-5 h-5 text-primary" />
                    Mi Perfil Profesional
                  </CardTitle>
                  <CardDescription>Información y validación CFIA</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="mb-6">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Estado:</span>
                      {profile?.status === 'approved' ? (
                        <span className="font-semibold text-emerald-600">Aprobado</span>
                      ) : profile?.status === 'pending' ? (
                        <span className="font-semibold text-amber-600">En revisión</span>
                      ) : profile?.status === 'rejected' ? (
                        <span className="font-semibold text-destructive">Rechazado</span>
                      ) : (
                        <span className="font-semibold text-muted-foreground">Incompleto</span>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/portal/profesional">Gestionar Perfil</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="border shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <Building className="w-5 h-5 text-primary" />
                    Mis Diseños
                  </CardTitle>
                  <CardDescription>Catálogo de planos publicados</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground mb-6">Cree y gestione sus propuestas arquitectónicas. Las publicaciones aprobadas estarán visibles en el catálogo público.</p>
                  <Button className="w-full" disabled={profile?.status !== 'approved'} asChild={profile?.status === 'approved'}>
                    {profile?.status === 'approved' ? (
                      <Link href="/portal/planos">Gestionar Planos</Link>
                    ) : (
                      <span>Requiere perfil aprobado</span>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          {me.role === 'buyer' && (
            <Card className="border shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <HomeIcon className="w-5 h-5 text-primary" />
                  Explorar Diseños
                </CardTitle>
                <CardDescription>Encuentre su futura casa</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-6">Explore diseños para su proyecto o solicite la verificación si desea publicar como profesional.</p>
                <div className="grid gap-3">
                <Button className="w-full" asChild>
                  <Link href="/catalogo">Ir al Catálogo</Link>
                </Button>
                <Button className="w-full" variant="outline" asChild>
                  <Link href="/portal/profesional">Quiero publicar como profesional</Link>
                </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
