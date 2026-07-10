-- 1. Eliminar la política anterior de modificación
DROP POLICY IF EXISTS "Rector modify own report details" ON public.detalle_reporte;

-- 2. Re-crear la política permitiendo modificaciones en estado 'pendiente' y 'observado'
CREATE POLICY "Rector modify own report details" ON public.detalle_reporte
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.reportes_horas_extras r 
            WHERE r.id = reporte_id AND r.ied_id = public.get_current_user_ied_id() AND r.estado IN ('pendiente', 'observado')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.reportes_horas_extras r 
            WHERE r.id = reporte_id AND r.ied_id = public.get_current_user_ied_id() AND r.estado IN ('pendiente', 'observado')
        )
    );
