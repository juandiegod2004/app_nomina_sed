-- MIGRACIÓN: CAMBIAR LLAVE PRIMARIA DE PERSONAL A UUID Y CÉDULA A ALFANUMÉRICO ÚNICO (MAX 10)
-- Ejecuta este script en el SQL Editor de tu consola Supabase

BEGIN;

-- 1. Registrar conteo inicial de filas para validación
DO $$
DECLARE
  v_personal_count_before INTEGER;
  v_detalle_count_before INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_personal_count_before FROM public.personal;
  SELECT COUNT(*) INTO v_detalle_count_before FROM public.detalle_reporte;
  
  RAISE NOTICE 'Conteo inicial - personal: %, detalle_reporte: %', v_personal_count_before, v_detalle_count_before;
END $$;

-- 2. Eliminar la restricción de llave foránea existente en detalle_reporte
ALTER TABLE public.detalle_reporte DROP CONSTRAINT IF EXISTS detalle_reporte_personal_id_fkey;

-- 3. Eliminar la restricción de cédula puramente numérica (chk_cedula_num) si existe
ALTER TABLE public.personal DROP CONSTRAINT IF EXISTS chk_cedula_num;

-- 4. Modificar la columna cedula para asegurar que sea VARCHAR(10), NOT NULL y UNIQUE
ALTER TABLE public.personal ALTER COLUMN cedula TYPE VARCHAR(10);
ALTER TABLE public.personal ALTER COLUMN cedula SET NOT NULL;
ALTER TABLE public.personal DROP CONSTRAINT IF EXISTS personal_cedula_key;
ALTER TABLE public.personal ADD CONSTRAINT personal_cedula_key UNIQUE (cedula);

-- 5. Agregar columna new_id (UUID) a la tabla personal con default autogenerado
ALTER TABLE public.personal ADD COLUMN new_id UUID DEFAULT gen_random_uuid();

-- 6. Garantizar que todos los registros de personal tengan un UUID en new_id
UPDATE public.personal SET new_id = gen_random_uuid() WHERE new_id IS NULL;

-- 7. Agregar columna temporal new_personal_id (UUID) a la tabla detalle_reporte
ALTER TABLE public.detalle_reporte ADD COLUMN new_personal_id UUID;

-- 8. Actualizar la relación en detalle_reporte usando la cédula (que hoy está en personal_id)
UPDATE public.detalle_reporte dr
SET new_personal_id = p.new_id
FROM public.personal p
WHERE dr.personal_id = p.id; -- En el esquema anterior, dr.personal_id y p.id almacenaban la cédula directamente

-- 9. VALIDACIÓN DE INTEGRIDAD
DO $$
DECLARE
  v_personal_count_before INTEGER;
  v_personal_count_after INTEGER;
  v_detalle_count_before INTEGER;
  v_detalle_count_after INTEGER;
  v_orphan_count INTEGER;
BEGIN
  -- Conteo de filas
  SELECT COUNT(*) INTO v_personal_count_after FROM public.personal;
  SELECT COUNT(*) INTO v_detalle_count_after FROM public.detalle_reporte;
  
  -- Verificar huérfanos
  SELECT COUNT(*) INTO v_orphan_count 
  FROM public.detalle_reporte 
  WHERE new_personal_id IS NULL AND personal_id IS NOT NULL;
  
  IF v_orphan_count > 0 THEN
    RAISE EXCEPTION 'MIGRACIÓN ABORTADA: Se encontraron % registros huérfanos en detalle_reporte.', v_orphan_count;
  END IF;
  
  RAISE NOTICE 'Conteo final - personal: %, detalle_reporte: %', v_personal_count_after, v_detalle_count_after;
END $$;

-- 10. Dropear la llave primaria vieja de personal (cedula)
ALTER TABLE public.personal DROP CONSTRAINT IF EXISTS personal_pkey;

-- 11. Eliminar la columna vieja id (cédula) de personal
ALTER TABLE public.personal DROP COLUMN id;

-- 12. Renombrar new_id a id y definirla como la nueva llave primaria
ALTER TABLE public.personal RENAME COLUMN new_id TO id;
ALTER TABLE public.personal ADD CONSTRAINT personal_pkey PRIMARY KEY (id);

-- 13. Reemplazar columna personal_id en detalle_reporte
ALTER TABLE public.detalle_reporte DROP COLUMN personal_id;
ALTER TABLE public.detalle_reporte RENAME COLUMN new_personal_id TO personal_id;
ALTER TABLE public.detalle_reporte ALTER COLUMN personal_id SET NOT NULL;

-- 14. Volver a crear la llave foránea vinculando los UUIDs
ALTER TABLE public.detalle_reporte 
  ADD CONSTRAINT detalle_reporte_personal_id_fkey 
  FOREIGN KEY (personal_id) REFERENCES public.personal(id) 
  ON DELETE RESTRICT;

-- 15. Recrear el índice de búsqueda compuesto optimizado
DROP INDEX IF EXISTS idx_personal_cedula_tipo;
CREATE INDEX IF NOT EXISTS idx_personal_cedula_tipo ON public.personal(cedula, tipo);

-- 16. Agregar política para permitir que los rectores lean docentes globales (con ied_id NULL)
DROP POLICY IF EXISTS "Rector read global docentes" ON public.personal;
CREATE POLICY "Rector read global docentes" ON public.personal
    FOR SELECT TO authenticated
    USING (ied_id IS NULL AND tipo = 'docente');

COMMIT;
