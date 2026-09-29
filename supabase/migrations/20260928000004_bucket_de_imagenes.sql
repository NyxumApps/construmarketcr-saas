-- Bucket privado para las imágenes de planos. Solo aplica en Supabase:
-- en un PostgreSQL local sin el esquema storage se omite sin error.
-- El servidor sirve las variantes públicas tras comprobar stored_objects.

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'plan-images',
      'plan-images',
      false,
      12582912,
      ARRAY['image/jpeg', 'image/png', 'image/webp']
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
END
$$;
