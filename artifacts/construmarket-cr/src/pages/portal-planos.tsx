import { useListMyPlans, useCreatePlan, useUpdatePlan, useGetMe, useGetProfessionalProfile } from '@workspace/api-client-react';
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
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown, ChevronLeft, ChevronUp, ImagePlus, Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import React, { useState, useEffect } from 'react';

const planSchema = z.object({
  title: z.string().min(3, 'Mínimo 3 caracteres'),
  description: z.string().min(20, 'Descripción más detallada requerida'),
  type: z.string().min(1, 'Requerido'),
  style: z.string().min(1, 'Requerido'),
  m2: z.coerce.number().min(20, 'Mínimo 20m2'),
  bedrooms: z.coerce.number().min(0),
  bathrooms: z.coerce.number().min(0),
  floors: z.coerce.number().min(1),
  priceUsd: z.coerce.number().min(1, 'Precio requerido'),
  constructionMinUsd: z.coerce.number().min(1),
  constructionMaxUsd: z.coerce.number().min(1),
  province: z.string().min(1, 'Requerido'),
  submitForReview: z.boolean().default(false),
});

type PlanImage = {
  originalPath: string;
  webPath: string;
  thumbnailPath: string;
  alt: string;
  focalX: number;
  focalY: number;
  previewUrl?: string;
};

function focalPosition(image: Pick<PlanImage, 'focalX' | 'focalY'>): string {
  return `${image.focalX ?? 50}% ${image.focalY ?? 50}%`;
}

async function resizeImage(file: File, maxWidth: number, quality: number): Promise<Blob> {
  let source: CanvasImageSource;
  let width: number;
  let height: number;
  let cleanup = () => {};

  try {
    const bitmap = await createImageBitmap(file);
    source = bitmap;
    width = bitmap.width;
    height = bitmap.height;
    cleanup = () => bitmap.close();
  } catch {
    const objectUrl = URL.createObjectURL(file);
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('La imagen seleccionada no se puede decodificar'));
      element.src = objectUrl;
    }).catch((error) => {
      URL.revokeObjectURL(objectUrl);
      throw error;
    });
    source = image;
    width = image.naturalWidth;
    height = image.naturalHeight;
    cleanup = () => URL.revokeObjectURL(objectUrl);
  }

  const scale = Math.min(1, maxWidth / width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
  cleanup();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('No se pudo optimizar la imagen')), 'image/webp', quality);
  });
}

async function uploadBlob(blob: Blob, name: string): Promise<string> {
  const response = await fetch('/api/storage/uploads/request-url', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, size: blob.size, contentType: blob.type }),
  });
  if (!response.ok) throw new Error((await response.json()).error ?? 'No se pudo iniciar la carga');
  const { uploadUrl, objectPath } = await response.json() as {
    uploadUrl: string;
    objectPath: string;
    publicUrl: string;
  };
  const upload = await fetch(uploadUrl, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': blob.type },
    body: blob,
  });
  if (!upload.ok) throw new Error('No se pudo cargar la imagen');
  return objectPath;
}

export default function PortalPlanos() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: me } = useGetMe();
  const { data: profile, isLoading: isProfileLoading } = useGetProfessionalProfile();
  const { data: plans = [], isLoading } = useListMyPlans();
  
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();

  const [editingPlan, setEditingPlan] = useState<number | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [images, setImages] = useState<PlanImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<z.infer<typeof planSchema>>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      title: '', description: '', type: '', style: '',
      m2: 100, bedrooms: 2, bathrooms: 1, floors: 1,
      priceUsd: 500, constructionMinUsd: 80000, constructionMaxUsd: 120000,
      province: 'sanjose', submitForReview: false
    }
  });

  const handleEdit = (plan: any) => {
    form.reset({
      title: plan.title,
      description: plan.description,
      type: plan.type,
      style: plan.style,
      m2: plan.m2,
      bedrooms: plan.bedrooms,
      bathrooms: plan.bathrooms,
      floors: plan.floors,
      priceUsd: plan.priceUsd,
      constructionMinUsd: plan.constructionMinUsd,
      constructionMaxUsd: plan.constructionMaxUsd,
      province: plan.province,
      submitForReview: false,
    });
    setImages((plan.images ?? []).map((image: PlanImage) => ({
      ...image,
      focalX: image.focalX ?? 50,
      focalY: image.focalY ?? 50,
    })));
    setEditingPlan(plan.id);
    setIsFormOpen(true);
  };

  const handleCreateNew = () => {
    form.reset({
      title: '', description: '', type: '', style: '',
      m2: 100, bedrooms: 2, bathrooms: 1, floors: 1,
      priceUsd: 500, constructionMinUsd: 80000, constructionMaxUsd: 120000,
      province: 'sanjose', submitForReview: false
    });
    setImages([]);
    setEditingPlan(null);
    setIsFormOpen(true);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const selected = Array.from(files).slice(0, 10 - images.length);
    setIsUploading(true);
    try {
      for (const file of selected) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) {
          throw new Error('Use imágenes JPG, PNG o WebP de hasta 12 MB');
        }
        const [web, thumbnail] = await Promise.all([
          resizeImage(file, 1600, 0.82),
          resizeImage(file, 640, 0.76),
        ]);
        const stem = file.name.replace(/\.[^.]+$/, '');
        const [originalPath, webPath, thumbnailPath] = await Promise.all([
          uploadBlob(file, file.name),
          uploadBlob(web, `${stem}-web.webp`),
          uploadBlob(thumbnail, `${stem}-thumb.webp`),
        ]);
        const uploaded = {
          originalPath,
          webPath,
          thumbnailPath,
          alt: form.getValues('title') || stem,
          focalX: 50,
          focalY: 50,
          previewUrl: URL.createObjectURL(thumbnail),
        };
        setImages((current) => [...current, uploaded]);
      }
    } catch (error) {
      toast({
        title: 'No se pudieron cargar las imágenes',
        description: error instanceof Error ? error.message : 'Intente nuevamente',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    setImages((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  };

  const updateImage = (index: number, values: Partial<PlanImage>) => {
    setImages((current) => current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...values } : item
    ));
  };

  const setFocalPointFromPointer = (index: number, event: React.PointerEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    updateImage(index, {
      focalX: Math.round(Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100))),
      focalY: Math.round(Math.min(100, Math.max(0, ((event.clientY - bounds.top) / bounds.height) * 100))),
    });
  };

  const onSubmit = (values: z.infer<typeof planSchema>) => {
    if (!editingPlan && images.length === 0) {
      toast({ title: 'Agregue al menos una imagen', variant: 'destructive' });
      return;
    }
    const persistedImages = images.map(({ previewUrl: _previewUrl, ...image }) => image);
    if (editingPlan) {
      updatePlan.mutate({ id: editingPlan, data: { ...values, images: persistedImages } }, {
        onSuccess: () => {
          toast({ title: 'Plano actualizado' });
          queryClient.invalidateQueries({ queryKey: ['/api/my-plans'] });
          setIsFormOpen(false);
        },
        onError: () => toast({ title: 'Error al actualizar', variant: 'destructive' })
      });
    } else {
      createPlan.mutate({ data: {
        ...values,
        images: persistedImages,
        imageUrl: `/api/storage${persistedImages[0]!.webPath}`,
      } }, {
        onSuccess: () => {
          toast({ title: 'Plano creado' });
          queryClient.invalidateQueries({ queryKey: ['/api/my-plans'] });
          setIsFormOpen(false);
        },
        onError: () => toast({ title: 'Error al crear', variant: 'destructive' })
      });
    }
  };

  if (me?.role !== 'professional' && me?.role !== 'admin') {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-12 text-center">
          <p>No tiene acceso a esta sección.</p>
        </main>
      </div>
    );
  }

  if (me?.role === 'professional' && isProfileLoading) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-12 flex items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (me?.role === 'professional' && profile?.status !== 'approved') {
    const rejected = profile?.status === 'rejected';
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-12 max-w-xl">
          <Card>
            <CardHeader>
              <CardTitle>
                {rejected ? 'Su perfil necesita correcciones' : 'Verificación profesional pendiente'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-muted-foreground">
                {rejected
                  ? 'Revise las observaciones y actualice su perfil antes de crear o editar diseños.'
                  : 'Podrá crear y administrar diseños cuando confirmemos su registro con el CFIA.'}
              </p>
              <Button asChild className="w-full sm:w-auto">
                <Link href="/portal/profesional">Revisar mi perfil</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary/20 selection:text-primary">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 md:px-8 py-12 max-w-5xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <Link href="/portal" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-4">
              <ChevronLeft className="w-4 h-4 mr-1" /> Volver al portal
            </Link>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">Mis Diseños</h1>
          </div>
          {!isFormOpen && (
            <Button onClick={handleCreateNew} className="shrink-0">
              <Plus className="w-4 h-4 mr-2" /> Nuevo Diseño
            </Button>
          )}
        </div>

        {isFormOpen ? (
          <div className="bg-card p-6 md:p-8 rounded-2xl border shadow-sm">
            <h2 className="text-2xl font-display font-bold mb-6">{editingPlan ? 'Editar Diseño' : 'Crear Nuevo Diseño'}</h2>
            
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="plan-title">Título del Diseño</Label>
                  <Input id="plan-title" {...form.register('title')} placeholder="Casa Tropical..." />
                  {form.formState.errors.title && <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="plan-type">Tipo de Proyecto</Label>
                  <Select onValueChange={(val) => form.setValue('type', val)} defaultValue={form.getValues('type')}>
                    <SelectTrigger id="plan-type"><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="casa">Casa</SelectItem>
                      <SelectItem value="cabana">Cabaña</SelectItem>
                      <SelectItem value="apartamento">Apartamento</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.type && <p className="text-xs text-destructive">{form.formState.errors.type.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="plan-style">Estilo Arquitectónico</Label>
                  <Select onValueChange={(val) => form.setValue('style', val)} defaultValue={form.getValues('style')}>
                    <SelectTrigger id="plan-style"><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tropical">Tropical Moderno</SelectItem>
                      <SelectItem value="minimalista">Minimalista</SelectItem>
                      <SelectItem value="colonial">Colonial</SelectItem>
                      <SelectItem value="rustico">Rústico</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.style && <p className="text-xs text-destructive">{form.formState.errors.style.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="plan-province">Provincia Ideal</Label>
                  <Select onValueChange={(val) => form.setValue('province', val)} defaultValue={form.getValues('province')}>
                    <SelectTrigger id="plan-province"><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sanjose">San José</SelectItem>
                      <SelectItem value="guanacaste">Guanacaste</SelectItem>
                      <SelectItem value="puntarenas">Puntarenas</SelectItem>
                      <SelectItem value="limon">Limón</SelectItem>
                      <SelectItem value="alajuela">Alajuela</SelectItem>
                      <SelectItem value="cartago">Cartago</SelectItem>
                      <SelectItem value="heredia">Heredia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="plan-area">Área (m²)</Label>
                  <Input id="plan-area" type="number" {...form.register('m2')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-bedrooms">Cuartos</Label>
                  <Input id="plan-bedrooms" type="number" {...form.register('bedrooms')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-bathrooms">Baños</Label>
                  <Input id="plan-bathrooms" type="number" step="0.5" {...form.register('bathrooms')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-floors">Niveles</Label>
                  <Input id="plan-floors" type="number" {...form.register('floors')} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="plan-price">Precio Planos (USD)</Label>
                  <Input id="plan-price" type="number" {...form.register('priceUsd')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-construction-min">Construcción Min (USD)</Label>
                  <Input id="plan-construction-min" type="number" {...form.register('constructionMinUsd')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-construction-max">Construcción Max (USD)</Label>
                  <Input id="plan-construction-max" type="number" {...form.register('constructionMaxUsd')} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <Label>Imágenes del diseño</Label>
                    <p className="text-xs text-muted-foreground mt-1">JPG, PNG o WebP · máximo 12 MB cada una · hasta 10 imágenes</p>
                  </div>
                  <Button type="button" variant="outline" asChild disabled={isUploading || images.length >= 10} className="w-full sm:w-auto">
                    <label className="cursor-pointer rounded-md focus-within:outline focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-ring">
                      {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImagePlus className="w-4 h-4 mr-2" />}
                      {isUploading ? 'Cargando...' : 'Agregar imágenes'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="sr-only"
                        onChange={(event) => {
                          void handleFiles(event.target.files);
                          event.target.value = '';
                        }}
                        disabled={isUploading || images.length >= 10}
                      />
                    </label>
                  </Button>
                </div>
                {images.length > 0 ? (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {images.map((image, index) => (
                      <div key={image.thumbnailPath} className="flex gap-3 rounded-xl border bg-muted/20 p-2">
                        <button
                          type="button"
                          className="relative h-28 w-32 shrink-0 overflow-hidden rounded-lg bg-muted cursor-crosshair focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onPointerDown={(event) => setFocalPointFromPointer(index, event)}
                          aria-label={`Elegir punto focal de imagen ${index + 1}`}
                        >
                          <img
                            src={image.previewUrl ?? `/api/storage${image.thumbnailPath}`}
                            alt={image.alt}
                            className="h-full w-full object-cover pointer-events-none"
                            style={{ objectPosition: focalPosition(image) }}
                          />
                          <span
                            className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-md pointer-events-none"
                            style={{ left: `${image.focalX}%`, top: `${image.focalY}%` }}
                          />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{index === 0 ? 'Portada' : `Imagen ${index + 1}`}</p>
                          <Input
                            value={image.alt}
                            onChange={(event) => updateImage(index, { alt: event.target.value })}
                            aria-label={`Texto alternativo de imagen ${index + 1}`}
                            className="h-8 mt-1 text-xs"
                          />
                          <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1 mt-2">
                            <Label htmlFor={`focal-x-${index}`} className="text-[11px] text-muted-foreground">Horizontal</Label>
                            <input
                              id={`focal-x-${index}`}
                              type="range"
                              min="0"
                              max="100"
                              value={image.focalX}
                              onChange={(event) => updateImage(index, { focalX: Number(event.target.value) })}
                              className="w-full accent-primary"
                            />
                            <Label htmlFor={`focal-y-${index}`} className="text-[11px] text-muted-foreground">Vertical</Label>
                            <input
                              id={`focal-y-${index}`}
                              type="range"
                              min="0"
                              max="100"
                              value={image.focalY}
                              onChange={(event) => updateImage(index, { focalY: Number(event.target.value) })}
                              className="w-full accent-primary"
                            />
                          </div>
                          <div className="flex gap-1 mt-1">
                            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={`Mover imagen ${index + 1} hacia arriba`} onClick={() => moveImage(index, -1)} disabled={index === 0}>
                              <ChevronUp className="w-4 h-4" />
                            </Button>
                            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={`Mover imagen ${index + 1} hacia abajo`} onClick={() => moveImage(index, 1)} disabled={index === images.length - 1}>
                              <ChevronDown className="w-4 h-4" />
                            </Button>
                            <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" aria-label={`Eliminar imagen ${index + 1}`} onClick={() => setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Suba imágenes desde su dispositivo. La primera será la portada.
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="plan-description">Descripción del Proyecto</Label>
                <Textarea id="plan-description" {...form.register('description')} className="min-h-[100px]" />
                {form.formState.errors.description && <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>}
              </div>

              <div className="flex items-center space-x-2 bg-muted/50 p-4 rounded-lg">
                <Switch 
                  id="submitForReview" 
                  checked={form.watch('submitForReview')} 
                  onCheckedChange={(val) => form.setValue('submitForReview', val)} 
                />
                <Label htmlFor="submitForReview" className="font-semibold cursor-pointer">Enviar a revisión para publicar</Label>
              </div>

              <div className="flex gap-4 pt-4 border-t border-border/50">
                <Button type="submit" disabled={isUploading || createPlan.isPending || updatePlan.isPending}>
                  {createPlan.isPending || updatePlan.isPending ? 'Guardando...' : 'Guardar Diseño'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
              </div>
            </form>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <div className="h-48 bg-muted rounded-t-xl" />
                  <CardContent className="p-4"><div className="h-6 bg-muted/50 w-2/3" /></CardContent>
                </Card>
              ))
            ) : plans.length > 0 ? (
              plans.map((plan) => (
                <Card key={plan.id} data-testid="my-plan-card" className="overflow-hidden flex flex-col">
                  <div className="h-48 relative overflow-hidden bg-muted">
                    <img
                      src={plan.images[0] ? `/api/storage${plan.images[0].webPath}` : plan.imageUrl || `https://picsum.photos/seed/${plan.id}/600/400`}
                      alt={plan.images[0]?.alt || plan.title}
                      className="w-full h-full object-cover"
                      style={{ objectPosition: plan.images[0] ? `${plan.images[0].focalX}% ${plan.images[0].focalY}%` : undefined }}
                    />
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="bg-background/90 text-foreground font-semibold uppercase">
                        {plan.status}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-4 flex-1">
                    <h3 className="font-display text-lg font-bold mb-1">{plan.title}</h3>
                    <p className="text-sm text-muted-foreground">{plan.m2}m² • {plan.bedrooms} Cuartos</p>
                    {plan.reviewNotes && plan.status === 'rejected' && (
                      <p className="text-xs text-destructive mt-2 font-medium">Rechazado: {plan.reviewNotes}</p>
                    )}
                  </CardContent>
                  <CardFooter className="p-4 pt-0 border-t border-border/50 flex gap-2">
                    <Button variant="outline" size="sm" className="w-full" onClick={() => handleEdit(plan)}>
                      <Pencil className="w-4 h-4 mr-2" /> Editar
                    </Button>
                  </CardFooter>
                </Card>
              ))
            ) : (
              <div className="col-span-full text-center py-20 bg-muted/20 rounded-2xl border border-dashed">
                <p className="text-muted-foreground mb-4">Aún no tiene diseños creados.</p>
                <Button onClick={handleCreateNew}>Crear mi primer diseño</Button>
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
