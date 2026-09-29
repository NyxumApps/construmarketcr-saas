import React, { useEffect, useRef } from 'react';
import { useGetProfessionalProfile, useUpsertProfessionalProfile } from '@workspace/api-client-react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useErrorToast } from '@/hooks/use-error-toast';
import { applyFieldErrors } from '@/lib/errors';
import { ChevronLeft, InfoIcon } from 'lucide-react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';

const profileSchema = z.object({
  name: z.string().min(2, 'Nombre es requerido'),
  email: z.string().email('Email inválido'),
  phone: z.string().min(8, 'Teléfono es requerido'),
  cfiaNumber: z.string().min(3, 'Carné CFIA requerido'),
  professionalType: z.string().min(1, 'Tipo de profesional requerido'),
  province: z.string().min(1, 'Provincia requerida'),
  bio: z.string().min(20, 'Biografía muy corta (min 20 caracteres)'),
});

export default function PortalProfesional() {
  const { toast } = useToast();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useGetProfessionalProfile();
  const upsertProfile = useUpsertProfessionalProfile();

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', email: '', phone: '', cfiaNumber: '', professionalType: '', province: '', bio: '' }
  });

  const initialized = useRef(false);

  useEffect(() => {
    if (profile && !initialized.current) {
      form.reset({
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        cfiaNumber: profile.cfiaNumber,
        professionalType: profile.professionalType,
        province: profile.province,
        bio: profile.bio,
      });
      initialized.current = true;
    }
  }, [profile, form]);

  const onSubmit = (values: z.infer<typeof profileSchema>) => {
    upsertProfile.mutate({ data: values }, {
      onSuccess: (data) => {
        toast({ title: 'Perfil actualizado', description: 'Sus datos han sido guardados correctamente.' });
        queryClient.setQueryData(['/api/professional-profile'], data);
        queryClient.invalidateQueries({ queryKey: ['/api/me'] });
      },
      onError: (error) => applyFieldErrors(form, showError(error)),
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary/20 selection:text-primary">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 md:px-8 py-12 max-w-3xl">
        <div className="mb-8">
          <Link href="/portal" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-4">
            <ChevronLeft className="w-4 h-4 mr-1" /> Volver al portal
          </Link>
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-2 text-foreground">Perfil Profesional</h1>
          <p className="text-muted-foreground">Complete o actualice su información para verificación CFIA.</p>
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-muted rounded-xl"></div>
            <div className="h-64 bg-muted rounded-xl"></div>
          </div>
        ) : (
          <div className="space-y-8">
            {profile?.status && (
              <Alert className={`
                ${profile.status === 'approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : ''}
                ${profile.status === 'pending' ? 'bg-amber-50 border-amber-200 text-amber-800' : ''}
                ${profile.status === 'rejected' ? 'bg-red-50 border-red-200 text-red-800' : ''}
              `}>
                <InfoIcon className="w-4 h-4" />
                <AlertTitle className="font-semibold">
                  {profile.status === 'approved' && 'Perfil Aprobado'}
                  {profile.status === 'pending' && 'En Revisión'}
                  {profile.status === 'rejected' && 'Perfil Rechazado'}
                </AlertTitle>
                <AlertDescription>
                  {profile.status === 'approved' && 'Su perfil está verificado. Puede publicar diseños en el catálogo.'}
                  {profile.status === 'pending' && 'Estamos validando su carné con el CFIA. Le notificaremos pronto.'}
                  {profile.status === 'rejected' && (
                    <>
                      <span className="block mb-2">No pudimos verificar su información. Por favor revise y actualice sus datos.</span>
                      {profile.reviewNotes && <strong>Motivo: {profile.reviewNotes}</strong>}
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={form.handleSubmit(onSubmit)} className="bg-card p-6 md:p-8 rounded-2xl border shadow-sm space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre / Firma</Label>
                  <Input id="name" placeholder="Ej. Arq. Juan Pérez" {...form.register('name')} />
                  {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cfiaNumber">Carné CFIA</Label>
                  <Input id="cfiaNumber" placeholder="A-12345" {...form.register('cfiaNumber')} />
                  {form.formState.errors.cfiaNumber && <p className="text-xs text-destructive">{form.formState.errors.cfiaNumber.message}</p>}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Correo electrónico de contacto</Label>
                  <Input id="email" type="email" placeholder="contacto@firma.com" {...form.register('email')} />
                  {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono principal</Label>
                  <Input id="phone" placeholder="8888-8888" {...form.register('phone')} />
                  {form.formState.errors.phone && <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="professionalType">Tipo de profesional</Label>
                  <Select onValueChange={(val) => form.setValue('professionalType', val)} defaultValue={form.getValues('professionalType') || undefined}>
                    <SelectTrigger id="professionalType">
                      <SelectValue placeholder="Seleccione un tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="arquitecto">Arquitecto(a)</SelectItem>
                      <SelectItem value="ingeniero_civil">Ingeniero(a) Civil</SelectItem>
                      <SelectItem value="empresa">Empresa / Constructora</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.professionalType && <p className="text-xs text-destructive">{form.formState.errors.professionalType.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="province">Provincia base</Label>
                  <Select onValueChange={(val) => form.setValue('province', val)} defaultValue={form.getValues('province') || undefined}>
                    <SelectTrigger id="province">
                      <SelectValue placeholder="Seleccione provincia" />
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
                <Label htmlFor="bio">Biografía o experiencia</Label>
                <Textarea 
                  id="bio" 
                  placeholder="Describa su experiencia, filosofía de diseño y proyectos destacados..." 
                  className="min-h-[120px]"
                  {...form.register('bio')} 
                />
                {form.formState.errors.bio && <p className="text-xs text-destructive">{form.formState.errors.bio.message}</p>}
              </div>

              <div className="pt-4 border-t border-border/50">
                <Button type="submit" className="w-full md:w-auto" disabled={upsertProfile.isPending}>
                  {upsertProfile.isPending ? 'Guardando...' : 'Guardar Perfil'}
                </Button>
              </div>
            </form>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
