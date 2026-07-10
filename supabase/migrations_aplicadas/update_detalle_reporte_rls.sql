-- 1. Eliminar la política anterior
DROP POLICY IF EXISTS "Rector manage own report details" ON public.detalle_reporte;

-- 2. Crear nueva política para lectura (SELECT) - Permite ver detalles de cualquier estado de reporte de su propia IED
CREATE POLICY "Rector view own report details" ON public.detalle_reporte
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.reportes_horas_extras r 
            WHERE r.id = reporte_id AND r.ied_id = public.get_current_user_ied_id()
        )
    );

-- 3. Crear nueva política para escritura (ALL: INSERT, UPDATE, DELETE) - Restringida a estado 'pendiente' y propia IED
CREATE POLICY "Rector modify own report details" ON public.detalle_reporte
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.reportes_horas_extras r 
            WHERE r.id = reporte_id AND r.ied_id = public.get_current_user_ied_id() AND r.estado = 'pendiente'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.reportes_horas_extras r 
            WHERE r.id = reporte_id AND r.ied_id = public.get_current_user_ied_id() AND r.estado = 'pendiente'
        )
    );
