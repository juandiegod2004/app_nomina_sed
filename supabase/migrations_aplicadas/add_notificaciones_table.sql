-- ====================================================================
-- MIGRACIÓN: CREACIÓN DE TABLA DE NOTIFICACIONES Y TRIGGERS AUTOMÁTICOS
-- ====================================================================

-- 1. CREACIÓN DE LA TABLA DE NOTIFICACIONES
CREATE TABLE IF NOT EXISTS public.notificaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL CONSTRAINT chk_tipo_notificacion CHECK (
        tipo IN ('reporte_aprobado', 'reporte_observado', 'reporte_nuevo', 'excede_tope', 'ied_sin_reportar')
    ),
    mensaje TEXT NOT NULL,
    leida BOOLEAN DEFAULT false NOT NULL,
    reporte_id UUID REFERENCES public.reportes_horas_extras(id) ON DELETE CASCADE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

-- Cada usuario lee sus propias notificaciones
CREATE POLICY "Usuarios pueden ver sus propias notificaciones" ON public.notificaciones
    FOR SELECT TO authenticated USING (auth.uid() = usuario_id);

-- Cada usuario marca sus propias notificaciones como leídas
CREATE POLICY "Usuarios pueden actualizar sus propias notificaciones" ON public.notificaciones
    FOR UPDATE TO authenticated USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);

-- 3. HABILITAR PUBLICACIÓN SUPABASE REALTIME
-- Nota: Habilita la transmisión de eventos en caliente
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones;

-- 4. FUNCIONES Y TRIGGERS AUTOMÁTICOS

-- TRIGGER A: Nuevo reporte -> Notificar a todos los administradores activos
CREATE OR REPLACE FUNCTION public.fn_notificar_reporte_nuevo()
RETURNS TRIGGER AS $$
DECLARE
    v_ied_nombre VARCHAR;
    v_admin RECORD;
BEGIN
    SELECT nombre INTO v_ied_nombre FROM public.ieds WHERE id = NEW.ied_id;

    FOR v_admin IN SELECT id FROM public.usuarios WHERE rol = 'admin_nomina' AND activo = true LOOP
        INSERT INTO public.notificaciones (usuario_id, tipo, mensaje, reporte_id)
        VALUES (
            v_admin.id,
            'reporte_nuevo',
            'Se ha radicado un nuevo reporte de horas extras para la IED ' || COALESCE(v_ied_nombre, 'desconocida') || ' (' || NEW.mes || '/' || NEW.año || ').',
            NEW.id
        );
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_reporte_nuevo
AFTER INSERT ON public.reportes_horas_extras
FOR EACH ROW
EXECUTE FUNCTION public.fn_notificar_reporte_nuevo();


-- TRIGGER B: Cambio de estado -> Notificar al rector propietario del reporte
CREATE OR REPLACE FUNCTION public.fn_notificar_estado_reporte()
RETURNS TRIGGER AS $$
DECLARE
    v_ied_nombre VARCHAR;
BEGIN
    IF OLD.estado IS DISTINCT FROM NEW.estado THEN
        SELECT nombre INTO v_ied_nombre FROM public.ieds WHERE id = NEW.ied_id;

        IF NEW.estado = 'aprobado' THEN
            INSERT INTO public.notificaciones (usuario_id, tipo, mensaje, reporte_id)
            VALUES (
                NEW.rector_id,
                'reporte_aprobado',
                'Su reporte de horas extras para la IED ' || COALESCE(v_ied_nombre, 'desconocida') || ' de ' || NEW.mes || '/' || NEW.año || ' ha sido APROBADO.',
                NEW.id
            );
        ELSIF NEW.estado = 'observado' THEN
            INSERT INTO public.notificaciones (usuario_id, tipo, mensaje, reporte_id)
            VALUES (
                NEW.rector_id,
                'reporte_observado',
                'Su reporte de horas extras para la IED ' || COALESCE(v_ied_nombre, 'desconocida') || ' de ' || NEW.mes || '/' || NEW.año || ' ha sido OBSERVADO. Motivo: ' || COALESCE(NEW.observacion, 'Sin detalles adicionales.'),
                NEW.id
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_estado_reporte
AFTER UPDATE ON public.reportes_horas_extras
FOR EACH ROW
EXECUTE FUNCTION public.fn_notificar_estado_reporte();


-- TRIGGER C: Exceso de topes -> Notificar a todos los administradores activos
CREATE OR REPLACE FUNCTION public.fn_notificar_excede_tope()
RETURNS TRIGGER AS $$
DECLARE
    v_ied_nombre VARCHAR;
    v_admin RECORD;
BEGIN
    IF NEW.excede_tope = true AND (TG_OP = 'INSERT' OR OLD.excede_tope = false) THEN
        SELECT nombre INTO v_ied_nombre FROM public.ieds WHERE id = NEW.ied_id;

        FOR v_admin IN SELECT id FROM public.usuarios WHERE rol = 'admin_nomina' AND activo = true LOOP
            INSERT INTO public.notificaciones (usuario_id, tipo, mensaje, reporte_id)
            VALUES (
                v_admin.id,
                'excede_tope',
                'Alerta: El reporte de la IED ' || COALESCE(v_ied_nombre, 'desconocida') || ' (' || NEW.mes || '/' || NEW.año || ') excede los límites de horas extras mensuales autorizados.',
                NEW.id
            );
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_excede_tope
AFTER INSERT OR UPDATE ON public.reportes_horas_extras
FOR EACH ROW
EXECUTE FUNCTION public.fn_notificar_excede_tope();
