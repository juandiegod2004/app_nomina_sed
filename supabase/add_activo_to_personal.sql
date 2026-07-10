-- MIGRACIÓN: AGREGAR COLUMNA ACTIVO A LA TABLA PERSONAL
-- Ejecuta este script en el SQL Editor de tu consola Supabase

ALTER TABLE public.personal ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true NOT NULL;
