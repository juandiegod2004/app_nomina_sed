-- ====================================================================
-- SCHEMA DE BASE DE DATOS PARA APP_NOMINA_HEXTRAS
-- Secretaría de Educación Departamental del Magdalena (.gov.co)
-- ====================================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. CREACIÓN DE TABLAS

-- TABLA: municipios
CREATE TABLE IF NOT EXISTS public.municipios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL UNIQUE
);

-- TABLA: ieds (Instituciones Educativas Departamentales)
-- Restricción DANE: exactamente 12 dígitos numéricos
CREATE TABLE IF NOT EXISTS public.ieds (
    id VARCHAR(12) PRIMARY KEY CONSTRAINT chk_dane_format CHECK (id ~ '^[0-9]{12}$'),
    nombre VARCHAR(255) NOT NULL,
    municipio_id INTEGER NOT NULL REFERENCES public.municipios(id) ON DELETE RESTRICT,
    residuo NUMERIC(10,2) DEFAULT 0 CHECK (residuo >= 0),
    necesidades_docentes INTEGER DEFAULT 0 CHECK (necesidades_docentes >= 0),
    jornada_unica INTEGER DEFAULT 0 CHECK (jornada_unica >= 0),
    adultos INTEGER DEFAULT 0 CHECK (adultos >= 0),
    total_he INTEGER DEFAULT 0 CHECK (total_he >= 0),
    dias_autorizados INTEGER DEFAULT NULL CHECK (dias_autorizados >= 0)
);

-- TABLA: personal (Docentes / Administrativos)
CREATE TABLE IF NOT EXISTS public.personal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cedula VARCHAR(10) NOT NULL UNIQUE,
    nombres VARCHAR(255) NOT NULL,
    apellidos VARCHAR(255) NOT NULL,
    cargo VARCHAR(100) NOT NULL,
    tipo VARCHAR(20) NOT NULL CONSTRAINT chk_tipo_personal CHECK (tipo IN ('docente', 'administrativo')),
    grado_escalafon VARCHAR(50),
    ied_id VARCHAR(12) REFERENCES public.ieds(id) ON DELETE CASCADE,
    activo BOOLEAN DEFAULT true NOT NULL
);

-- TABLA: usuarios (Rectores / Administradores de Nómina)
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    cedula VARCHAR(20) NOT NULL UNIQUE CONSTRAINT chk_cedula_user CHECK (cedula ~ '^[0-9]+$'),
    nombre VARCHAR(255) NOT NULL,
    correo_institucional VARCHAR(255) NOT NULL UNIQUE 
        CONSTRAINT chk_correo_gov CHECK (correo_institucional ~ '^[A-Za-z0-9._%+-]+@sedmagdalena\.gov\.co$'),
    rol VARCHAR(20) NOT NULL CONSTRAINT chk_rol_usuario CHECK (rol IN ('rector', 'admin_nomina')),
    ied_id VARCHAR(12) REFERENCES public.ieds(id) ON DELETE SET NULL,
    activo BOOLEAN DEFAULT true NOT NULL,
    requiere_cambio_clave BOOLEAN DEFAULT true NOT NULL,
    
    -- Restricción: Rector debe tener IED asociada; Administrador no
    CONSTRAINT chk_rol_ied_coherencia CHECK (
        (rol = 'rector' AND ied_id IS NOT NULL) OR 
        (rol = 'admin_nomina' AND ied_id IS NULL)
    )
);

-- TABLA: reportes_horas_extras (Cabecera mensual)
CREATE TABLE IF NOT EXISTS public.reportes_horas_extras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    radicado VARCHAR(50) UNIQUE,
    ied_id VARCHAR(12) NOT NULL REFERENCES public.ieds(id) ON DELETE RESTRICT,
    rector_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    mes INTEGER NOT NULL CONSTRAINT chk_mes CHECK (mes BETWEEN 1 AND 12),
    año INTEGER NOT NULL CONSTRAINT chk_año CHECK (año >= 2026),
    estado VARCHAR(20) DEFAULT 'pendiente' NOT NULL CONSTRAINT chk_estado CHECK (estado IN ('pendiente', 'aprobado', 'observado')),
    observacion VARCHAR(1000),
    exportado BOOLEAN DEFAULT false NOT NULL,
    excede_tope BOOLEAN DEFAULT false NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- TABLA: detalle_reporte (Detalle de horas reportadas por docente/personal)
CREATE TABLE IF NOT EXISTS public.detalle_reporte (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporte_id UUID NOT NULL REFERENCES public.reportes_horas_extras(id) ON DELETE CASCADE,
    personal_id UUID NOT NULL REFERENCES public.personal(id) ON DELETE RESTRICT,
    residuo INTEGER DEFAULT 0 CHECK (residuo >= 0),
    sustitucion INTEGER DEFAULT 0 CHECK (sustitucion >= 0),
    jornada_unica INTEGER DEFAULT 0 CHECK (jornada_unica >= 0),
    adultos INTEGER DEFAULT 0 CHECK (adultos >= 0),
    dom_diurno INTEGER DEFAULT 0 CHECK (dom_diurno >= 0),
    dom_nocturno INTEGER DEFAULT 0 CHECK (dom_nocturno >= 0),
    fest_diurno INTEGER DEFAULT 0 CHECK (fest_diurno >= 0),
    fest_nocturno INTEGER DEFAULT 0 CHECK (fest_nocturno >= 0),
    recargo_nocturno INTEGER DEFAULT 0 CHECK (recargo_nocturno >= 0)
);

-- TABLA: auditoria (Bitácora de seguridad .gov)
CREATE TABLE IF NOT EXISTS public.auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    accion VARCHAR(255) NOT NULL,
    tabla_afectada VARCHAR(100) NOT NULL,
    registro_id UUID NOT NULL,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ip VARCHAR(45)
);

-- SECUENCIA para la generación de radicados
CREATE SEQUENCE IF NOT EXISTS public.radicado_seq;


-- ====================================================================
-- 2. TRIGGERS Y FUNCIONES AUXILIARES

-- Trigger para autogenerar Radicado formateado (Ej: RAD-2026-07-0001)
CREATE OR REPLACE FUNCTION public.handle_generar_radicado()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.radicado IS NULL THEN
        NEW.radicado := 'RAD-' || NEW.año || '-' || TO_CHAR(NEW.mes, 'FM00') || '-' || TO_CHAR(nextval('public.radicado_seq'), 'FM0000');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_generar_radicado
BEFORE INSERT ON public.reportes_horas_extras
FOR EACH ROW EXECUTE FUNCTION public.handle_generar_radicado();


-- Trigger para actualizar columna 'actualizado_en'
CREATE OR REPLACE FUNCTION public.handle_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_update_timestamp_reportes
BEFORE UPDATE ON public.reportes_horas_extras
FOR EACH ROW EXECUTE FUNCTION public.handle_update_timestamp();


-- ====================================================================
-- 3. INTEGRACIÓN DE CUSTOM CLAIMS (JWT)
-- Sincroniza rol e ied_id de usuarios con raw_app_meta_data de auth.users

CREATE OR REPLACE FUNCTION public.handle_sync_user_claims()
RETURNS TRIGGER AS $$
DECLARE
    current_rol TEXT;
    current_ied TEXT;
BEGIN
    -- Obtener valores actuales de claims en auth.users
    SELECT 
        (raw_app_meta_data ->> 'rol'),
        (raw_app_meta_data ->> 'ied_id')
    INTO current_rol, current_ied
    FROM auth.users
    WHERE id = NEW.auth_id;

    -- Solo actualizar si hay un cambio real en los claims para evitar bucles infinitos
    IF (current_rol IS DISTINCT FROM NEW.rol) OR (current_ied IS DISTINCT FROM NEW.ied_id) THEN
        UPDATE auth.users
        SET raw_app_meta_data = 
            coalesce(raw_app_meta_data, '{}'::jsonb) || 
            jsonb_build_object('rol', NEW.rol, 'ied_id', NEW.ied_id)
        WHERE id = NEW.auth_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_sync_user_claims
AFTER INSERT OR UPDATE ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.handle_sync_user_claims();


-- Sincronizar borrado de usuarios: al borrar de public.usuarios, borrar automáticamente de auth.users
CREATE OR REPLACE FUNCTION public.handle_on_usuario_deleted()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM auth.users WHERE id = OLD.auth_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_on_usuario_deleted
AFTER DELETE ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.handle_on_usuario_deleted();


-- Funciones seguras para leer claims desde RLS sin queries pesadas
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
    SELECT coalesce(
        (auth.jwt() -> 'app_metadata' ->> 'rol')::text,
        ''
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_current_user_ied_id()
RETURNS VARCHAR AS $$
    SELECT coalesce(
        (auth.jwt() -> 'app_metadata' ->> 'ied_id')::varchar,
        ''
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- ====================================================================
-- 4. ROW LEVEL SECURITY (RLS)

-- Habilitar RLS en todas las tablas
ALTER TABLE public.municipios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ieds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reportes_horas_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_reporte ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

-- Políticas: municipios
CREATE POLICY "Public/Authenticated read municipios" ON public.municipios
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin write municipios" ON public.municipios
    FOR ALL TO authenticated USING (public.get_current_user_role() = 'admin_nomina');

-- Políticas: ieds
CREATE POLICY "Authenticated read ieds" ON public.ieds
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin write ieds" ON public.ieds
    FOR ALL TO authenticated USING (public.get_current_user_role() = 'admin_nomina');

-- Políticas: personal
CREATE POLICY "Rector manage own ied personal" ON public.personal
    FOR ALL TO authenticated 
    USING (ied_id = public.get_current_user_ied_id())
    WITH CHECK (ied_id = public.get_current_user_ied_id());

CREATE POLICY "Rector read global docentes" ON public.personal
    FOR SELECT TO authenticated
    USING (ied_id IS NULL AND tipo = 'docente');

CREATE POLICY "Admin manage all personal" ON public.personal
    FOR ALL TO authenticated USING (public.get_current_user_role() = 'admin_nomina');

-- Políticas: usuarios
CREATE POLICY "Users read own profile" ON public.usuarios
    FOR SELECT TO authenticated USING (auth_id = auth.uid());

CREATE POLICY "Users update own profile" ON public.usuarios
    FOR UPDATE TO authenticated
    USING (auth_id = auth.uid())
    WITH CHECK (auth_id = auth.uid());

CREATE POLICY "Admin manage all users" ON public.usuarios
    FOR ALL TO authenticated USING (public.get_current_user_role() = 'admin_nomina');

-- Políticas: reportes_horas_extras
CREATE POLICY "Rector manage own reportes" ON public.reportes_horas_extras
    FOR ALL TO authenticated 
    USING (ied_id = public.get_current_user_ied_id())
    WITH CHECK (ied_id = public.get_current_user_ied_id() AND estado = 'pendiente');

CREATE POLICY "Admin manage all reportes" ON public.reportes_horas_extras
    FOR ALL TO authenticated USING (public.get_current_user_role() = 'admin_nomina');

-- Políticas: detalle_reporte
CREATE POLICY "Rector view own report details" ON public.detalle_reporte
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.reportes_horas_extras r 
            WHERE r.id = reporte_id AND r.ied_id = public.get_current_user_ied_id()
        )
    );

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

CREATE POLICY "Admin manage all details" ON public.detalle_reporte
    FOR ALL TO authenticated USING (public.get_current_user_role() = 'admin_nomina');

-- Políticas: auditoria (Solo el admin puede consultarla. Inserciones automáticas vía Security Definer)
CREATE POLICY "Admin read auditoria" ON public.auditoria
    FOR SELECT TO authenticated USING (public.get_current_user_role() = 'admin_nomina');


-- ====================================================================
-- 5. BITÁCORA DE AUDITORÍA AUTOMÁTICA (TRIGGER)

CREATE OR REPLACE FUNCTION public.process_audit_reportes_log()
RETURNS TRIGGER AS $$
DECLARE
    curr_user_id UUID;
    action_desc VARCHAR(255);
    reg_id UUID;
BEGIN
    -- Obtener id de la tabla usuarios en base al auth_id actual
    SELECT id INTO curr_user_id FROM public.usuarios WHERE auth_id = auth.uid();
    reg_id := coalesce(NEW.id, OLD.id);

    IF (TG_OP = 'INSERT') THEN
        action_desc := 'Creación de registro en reportes_horas_extras';
    ELSIF (TG_OP = 'UPDATE') THEN
        IF OLD.estado <> NEW.estado THEN
            action_desc := 'Cambio de estado de reporte: ' || UPPER(OLD.estado) || ' -> ' || UPPER(NEW.estado);
            IF NEW.estado = 'observado' THEN
                action_desc := action_desc || '. Observación: ' || coalesce(NEW.observacion, 'Sin observación');
            END IF;
        ELSE
            action_desc := 'Modificación de registro en reportes_horas_extras';
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        action_desc := 'Eliminación de registro en reportes_horas_extras';
        reg_id := OLD.id;
    END IF;

    INSERT INTO public.auditoria (usuario_id, accion, tabla_afectada, registro_id, ip)
    VALUES (curr_user_id, action_desc, 'reportes_horas_extras', reg_id, inet_client_addr()::varchar);
    
    RETURN coalesce(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.process_audit_usuarios_log()
RETURNS TRIGGER AS $$
DECLARE
    curr_user_id UUID;
    action_desc VARCHAR(255);
    reg_id UUID;
BEGIN
    -- Obtener id de la tabla usuarios en base al auth_id actual
    SELECT id INTO curr_user_id FROM public.usuarios WHERE auth_id = auth.uid();
    reg_id := coalesce(NEW.id, OLD.id);

    IF (TG_OP = 'INSERT') THEN
        action_desc := 'Creación de registro en usuarios';
    ELSIF (TG_OP = 'UPDATE') THEN
        action_desc := 'Modificación de registro en usuarios';
    ELSIF (TG_OP = 'DELETE') THEN
        action_desc := 'Eliminación de registro en usuarios';
        reg_id := OLD.id;
    END IF;

    INSERT INTO public.auditoria (usuario_id, accion, tabla_afectada, registro_id, ip)
    VALUES (curr_user_id, action_desc, 'usuarios', reg_id, inet_client_addr()::varchar);
    
    RETURN coalesce(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Disparadores de auditoría
CREATE OR REPLACE TRIGGER trg_audit_reportes
AFTER INSERT OR UPDATE OR DELETE ON public.reportes_horas_extras
FOR EACH ROW EXECUTE FUNCTION public.process_audit_reportes_log();

CREATE OR REPLACE TRIGGER trg_audit_usuarios
AFTER INSERT OR UPDATE OR DELETE ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.process_audit_usuarios_log();


-- ====================================================================
-- 6. PROCEDIMIENTOS ALMACENADOS / ENDPOINTS RPC

-- RPC: Crear Rector de manera segura (Solo admin)
CREATE OR REPLACE FUNCTION public.crear_rector(
    p_cedula VARCHAR,
    p_nombre VARCHAR,
    p_correo VARCHAR,
    p_password VARCHAR,
    p_ied_id VARCHAR
) RETURNS UUID AS $$
DECLARE
    new_auth_id UUID;
    new_user_id UUID;
    encrypted_pw TEXT;
BEGIN
    -- 1. Validar que el solicitante sea admin_nomina
    IF public.get_current_user_role() <> 'admin_nomina' THEN
        RAISE EXCEPTION 'No autorizado: Solo administradores de nómina pueden crear rectores';
    END IF;

    -- 2. Validar que el correo pertenezca al dominio .gov.co
    IF p_correo NOT LIKE '%@sedmagdalena.gov.co' THEN
        RAISE EXCEPTION 'El correo institucional debe finalizar en @sedmagdalena.gov.co';
    END IF;

    -- 3. Generar hash de contraseña segura
    encrypted_pw := crypt(p_password, gen_salt('bf'));

    -- 4. Registrar en auth.users (Supabase GoTrue)
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        p_correo,
        encrypted_pw,
        CURRENT_TIMESTAMP,
        jsonb_build_object('provider', 'email', 'providers', array['email'], 'rol', 'rector', 'ied_id', p_ied_id),
        jsonb_build_object('name', p_nombre),
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ) RETURNING id INTO new_auth_id;

    -- 5. Registrar en la tabla de usuarios
    INSERT INTO public.usuarios (
        auth_id,
        cedula,
        nombre,
        correo_institucional,
        rol,
        ied_id,
        activo
    ) VALUES (
        new_auth_id,
        p_cedula,
        p_nombre,
        p_correo,
        'rector',
        p_ied_id,
        true
    ) RETURNING id INTO new_user_id;

    -- Registrar auditoría explícita
    INSERT INTO public.auditoria (usuario_id, accion, tabla_afectada, registro_id)
    VALUES (
        (SELECT id FROM public.usuarios WHERE auth_id = auth.uid()),
        'Creación de rector: ' || p_nombre || ' asignado a la IED: ' || p_ied_id,
        'usuarios',
        new_user_id
    );

    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC: Exportar Consolidado Mensual Plano (Solo admin)
CREATE OR REPLACE FUNCTION public.exportar_consolidado_mensual(
    p_mes INTEGER,
    p_año INTEGER
) RETURNS TABLE (
    cedula VARCHAR(20),
    codigo_concepto VARCHAR(10),
    fecha_ocurrencia VARCHAR(10),
    fecha_liquidacion VARCHAR(10),
    valor INTEGER,
    centro_costo VARCHAR(12)
) AS $$
BEGIN
    -- Validar rol admin_nomina
    IF public.get_current_user_role() <> 'admin_nomina' THEN
        RAISE EXCEPTION 'No autorizado: Solo administradores de nómina pueden exportar consolidados';
    END IF;

    RETURN QUERY
    -- Unimos y normalizamos los diferentes conceptos de horas extras en registros planos
    -- Cada concepto tiene asignado un código contable de nómina estándar (Mocked / .gov std)
    
    -- Concepto 1: Residuo (Código Concepto: HE01)
    SELECT 
        p.cedula,
        'HE01'::VARCHAR(10) AS codigo_concepto,
        TO_CHAR(r.creado_en, 'YYYY-MM-DD')::VARCHAR(10) AS fecha_ocurrencia,
        (p_año || '-' || TO_CHAR(p_mes, 'FM00') || '-28')::VARCHAR(10) AS fecha_liquidacion,
        d.residuo AS valor,
        r.ied_id::VARCHAR(12) AS centro_costo
    FROM public.detalle_reporte d
    JOIN public.reportes_horas_extras r ON d.reporte_id = r.id
    JOIN public.personal p ON d.personal_id = p.id
    WHERE r.mes = p_mes AND r.año = p_año AND r.estado = 'aprobado' AND d.residuo > 0

    UNION ALL

    -- Concepto 2: Sustitución (Código Concepto: HE02)
    SELECT 
        p.cedula,
        'HE02'::VARCHAR(10),
        TO_CHAR(r.creado_en, 'YYYY-MM-DD')::VARCHAR(10),
        (p_año || '-' || TO_CHAR(p_mes, 'FM00') || '-28')::VARCHAR(10),
        d.sustitucion,
        r.ied_id::VARCHAR(12)
    FROM public.detalle_reporte d
    JOIN public.reportes_horas_extras r ON d.reporte_id = r.id
    JOIN public.personal p ON d.personal_id = p.id
    WHERE r.mes = p_mes AND r.año = p_año AND r.estado = 'aprobado' AND d.sustitucion > 0

    UNION ALL

    -- Concepto 3: Jornada Única (Código Concepto: HE03)
    SELECT 
        p.cedula,
        'HE03'::VARCHAR(10),
        TO_CHAR(r.creado_en, 'YYYY-MM-DD')::VARCHAR(10),
        (p_año || '-' || TO_CHAR(p_mes, 'FM00') || '-28')::VARCHAR(10),
        d.jornada_unica,
        r.ied_id::VARCHAR(12)
    FROM public.detalle_reporte d
    JOIN public.reportes_horas_extras r ON d.reporte_id = r.id
    JOIN public.personal p ON d.personal_id = p.id
    WHERE r.mes = p_mes AND r.año = p_año AND r.estado = 'aprobado' AND d.jornada_unica > 0

    UNION ALL

    -- Concepto 4: Adultos (Código Concepto: HE04)
    SELECT 
        p.cedula,
        'HE04'::VARCHAR(10),
        TO_CHAR(r.creado_en, 'YYYY-MM-DD')::VARCHAR(10),
        (p_año || '-' || TO_CHAR(p_mes, 'FM00') || '-28')::VARCHAR(10),
        d.adultos,
        r.ied_id::VARCHAR(12)
    FROM public.detalle_reporte d
    JOIN public.reportes_horas_extras r ON d.reporte_id = r.id
    JOIN public.personal p ON d.personal_id = p.id
    WHERE r.mes = p_mes AND r.año = p_año AND r.estado = 'aprobado' AND d.adultos > 0

    UNION ALL

    -- Concepto 5: Dominical Diurno (Código Concepto: HEDD)
    SELECT 
        p.cedula,
        'HEDD'::VARCHAR(10),
        TO_CHAR(r.creado_en, 'YYYY-MM-DD')::VARCHAR(10),
        (p_año || '-' || TO_CHAR(p_mes, 'FM00') || '-28')::VARCHAR(10),
        d.dom_diurno,
        r.ied_id::VARCHAR(12)
    FROM public.detalle_reporte d
    JOIN public.reportes_horas_extras r ON d.reporte_id = r.id
    JOIN public.personal p ON d.personal_id = p.id
    WHERE r.mes = p_mes AND r.año = p_año AND r.estado = 'aprobado' AND d.dom_diurno > 0

    UNION ALL

    -- Concepto 6: Dominical Nocturno (Código Concepto: HEDN)
    SELECT 
        p.cedula,
        'HEDN'::VARCHAR(10),
        TO_CHAR(r.creado_en, 'YYYY-MM-DD')::VARCHAR(10),
        (p_año || '-' || TO_CHAR(p_mes, 'FM00') || '-28')::VARCHAR(10),
        d.dom_nocturno,
        r.ied_id::VARCHAR(12)
    FROM public.detalle_reporte d
    JOIN public.reportes_horas_extras r ON d.reporte_id = r.id
    JOIN public.personal p ON d.personal_id = p.id
    WHERE r.mes = p_mes AND r.año = p_año AND r.estado = 'aprobado' AND d.dom_nocturno > 0

    UNION ALL

    -- Concepto 7: Festivo Diurno (Código Concepto: HEFD)
    SELECT 
        p.cedula,
        'HEFD'::VARCHAR(10),
        TO_CHAR(r.creado_en, 'YYYY-MM-DD')::VARCHAR(10),
        (p_año || '-' || TO_CHAR(p_mes, 'FM00') || '-28')::VARCHAR(10),
        d.fest_diurno,
        r.ied_id::VARCHAR(12)
    FROM public.detalle_reporte d
    JOIN public.reportes_horas_extras r ON d.reporte_id = r.id
    JOIN public.personal p ON d.personal_id = p.id
    WHERE r.mes = p_mes AND r.año = p_año AND r.estado = 'aprobado' AND d.fest_diurno > 0

    UNION ALL

    -- Concepto 8: Festivo Nocturno (Código Concepto: HEFN)
    SELECT 
        p.cedula,
        'HEFN'::VARCHAR(10),
        TO_CHAR(r.creado_en, 'YYYY-MM-DD')::VARCHAR(10),
        (p_año || '-' || TO_CHAR(p_mes, 'FM00') || '-28')::VARCHAR(10),
        d.fest_nocturno,
        r.ied_id::VARCHAR(12)
    FROM public.detalle_reporte d
    JOIN public.reportes_horas_extras r ON d.reporte_id = r.id
    JOIN public.personal p ON d.personal_id = p.id
    WHERE r.mes = p_mes AND r.año = p_año AND r.estado = 'aprobado' AND d.fest_nocturno > 0

    UNION ALL

    -- Concepto 9: Recargo Nocturno (Código Concepto: HERN)
    SELECT 
        p.cedula,
        'HERN'::VARCHAR(10),
        TO_CHAR(r.creado_en, 'YYYY-MM-DD')::VARCHAR(10),
        (p_año || '-' || TO_CHAR(p_mes, 'FM00') || '-28')::VARCHAR(10),
        d.recargo_nocturno,
        r.ied_id::VARCHAR(12)
    FROM public.detalle_reporte d
    JOIN public.reportes_horas_extras r ON d.reporte_id = r.id
    JOIN public.personal p ON d.personal_id = p.id
    WHERE r.mes = p_mes AND r.año = p_año AND r.estado = 'aprobado' AND d.recargo_nocturno > 0;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- RPC: Exportar Consolidado Mensual Plano Masivo v2 (Solo admin)
CREATE OR REPLACE FUNCTION public.exportar_consolidado_mensual_v2(
    p_mes INTEGER,
    p_anio INTEGER,
    p_incluir_ya_exportados BOOLEAN DEFAULT false
) RETURNS TABLE (
    codempleado VARCHAR(20),
    codconcepto VARCHAR(10),
    fechaocurrencia VARCHAR(10),
    fechaliquidacion VARCHAR(10),
    valor INTEGER,
    centrocosto VARCHAR(255)
) AS $$
DECLARE
    last_day DATE;
    liq_day DATE;
    v_report_count INTEGER;
BEGIN
    -- Validar rol admin_nomina
    IF public.get_current_user_role() <> 'admin_nomina' THEN
        RAISE EXCEPTION 'No autorizado: Solo administradores de nómina pueden exportar consolidados';
    END IF;

    -- Calcular fechas con base en el mes/año filtrado
    last_day := (p_anio || '-' || TO_CHAR(p_mes, 'FM00') || '-01')::DATE + INTERVAL '1 month' - INTERVAL '1 day';
    liq_day := (p_anio || '-' || TO_CHAR(p_mes, 'FM00') || '-01')::DATE + INTERVAL '1 month' + INTERVAL '27 days';

    -- Crear tabla temporal para guardar los registros consolidados
    CREATE TEMP TABLE temp_consolidado ON COMMIT DROP AS
    SELECT * FROM (
        -- Concepto 1: Residuo (HEXTREG)
        SELECT 
            p.cedula AS t_codempleado,
            'HEXTREG'::VARCHAR(10) AS t_codconcepto,
            TO_CHAR(last_day, 'YYYY-MM-DD')::VARCHAR(10) AS t_fechaocurrencia,
            TO_CHAR(liq_day, 'YYYY-MM-DD')::VARCHAR(10) AS t_fechaliquidacion,
            d.residuo AS t_valor,
            i.nombre::VARCHAR(255) AS t_centrocosto,
            r.id AS t_reporte_id
        FROM public.detalle_reporte d
        JOIN public.reportes_horas_extras r ON d.reporte_id = r.id
        JOIN public.personal p ON d.personal_id = p.id
        JOIN public.ieds i ON r.ied_id = i.id
        WHERE r.mes = p_mes 
          AND r.año = p_anio 
          AND r.estado = 'aprobado' 
          AND (p_incluir_ya_exportados OR NOT r.exportado)
          AND d.residuo > 0

        UNION ALL

        -- Concepto 2: Sustitución (HEXTREG)
        SELECT 
            p.cedula,
            'HEXTREG'::VARCHAR(10),
            TO_CHAR(last_day, 'YYYY-MM-DD')::VARCHAR(10),
            TO_CHAR(liq_day, 'YYYY-MM-DD')::VARCHAR(10),
            d.sustitucion,
            i.nombre::VARCHAR(255),
            r.id
        FROM public.detalle_reporte d
        JOIN public.reportes_horas_extras r ON d.reporte_id = r.id
        JOIN public.personal p ON d.personal_id = p.id
        JOIN public.ieds i ON r.ied_id = i.id
        WHERE r.mes = p_mes 
          AND r.año = p_anio 
          AND r.estado = 'aprobado' 
          AND (p_incluir_ya_exportados OR NOT r.exportado)
          AND d.sustitucion > 0

        UNION ALL

        -- Concepto 3: Jornada Única (HEXTJU)
        SELECT 
            p.cedula,
            'HEXTJU'::VARCHAR(10),
            TO_CHAR(last_day, 'YYYY-MM-DD')::VARCHAR(10),
            TO_CHAR(liq_day, 'YYYY-MM-DD')::VARCHAR(10),
            d.jornada_unica,
            i.nombre::VARCHAR(255),
            r.id
        FROM public.detalle_reporte d
        JOIN public.reportes_horas_extras r ON d.reporte_id = r.id
        JOIN public.personal p ON d.personal_id = p.id
        JOIN public.ieds i ON r.ied_id = i.id
        WHERE r.mes = p_mes 
          AND r.año = p_anio 
          AND r.estado = 'aprobado' 
          AND (p_incluir_ya_exportados OR NOT r.exportado)
          AND d.jornada_unica > 0

        UNION ALL

        -- Concepto 4: Adultos (HEXTADUL)
        SELECT 
            p.cedula,
            'HEXTADUL'::VARCHAR(10),
            TO_CHAR(last_day, 'YYYY-MM-DD')::VARCHAR(10),
            TO_CHAR(liq_day, 'YYYY-MM-DD')::VARCHAR(10),
            d.adultos,
            i.nombre::VARCHAR(255),
            r.id
        FROM public.detalle_reporte d
        JOIN public.reportes_horas_extras r ON d.reporte_id = r.id
        JOIN public.personal p ON d.personal_id = p.id
        JOIN public.ieds i ON r.ied_id = i.id
        WHERE r.mes = p_mes 
          AND r.año = p_anio 
          AND r.estado = 'aprobado' 
          AND (p_incluir_ya_exportados OR NOT r.exportado)
          AND d.adultos > 0

        UNION ALL

        -- Concepto 5: Dom Diurno (HEXDD)
        SELECT 
            p.cedula,
            'HEXDD'::VARCHAR(10),
            TO_CHAR(last_day, 'YYYY-MM-DD')::VARCHAR(10),
            TO_CHAR(liq_day, 'YYYY-MM-DD')::VARCHAR(10),
            d.dom_diurno,
            i.nombre::VARCHAR(255),
            r.id
        FROM public.detalle_reporte d
        JOIN public.reportes_horas_extras r ON d.reporte_id = r.id
        JOIN public.personal p ON d.personal_id = p.id
        JOIN public.ieds i ON r.ied_id = i.id
        WHERE r.mes = p_mes 
          AND r.año = p_anio 
          AND r.estado = 'aprobado' 
          AND (p_incluir_ya_exportados OR NOT r.exportado)
          AND d.dom_diurno > 0

        UNION ALL

        -- Concepto 6: Dom Nocturno (HEXDN)
        SELECT 
            p.cedula,
            'HEXDN'::VARCHAR(10),
            TO_CHAR(last_day, 'YYYY-MM-DD')::VARCHAR(10),
            TO_CHAR(liq_day, 'YYYY-MM-DD')::VARCHAR(10),
            d.dom_nocturno,
            i.nombre::VARCHAR(255),
            r.id
        FROM public.detalle_reporte d
        JOIN public.reportes_horas_extras r ON d.reporte_id = r.id
        JOIN public.personal p ON d.personal_id = p.id
        JOIN public.ieds i ON r.ied_id = i.id
        WHERE r.mes = p_mes 
          AND r.año = p_anio 
          AND r.estado = 'aprobado' 
          AND (p_incluir_ya_exportados OR NOT r.exportado)
          AND d.dom_nocturno > 0

        UNION ALL

        -- Concepto 7: Fest Diurno (HEXFD)
        SELECT 
            p.cedula,
            'HEXFD'::VARCHAR(10),
            TO_CHAR(last_day, 'YYYY-MM-DD')::VARCHAR(10),
            TO_CHAR(liq_day, 'YYYY-MM-DD')::VARCHAR(10),
            d.fest_diurno,
            i.nombre::VARCHAR(255),
            r.id
        FROM public.detalle_reporte d
        JOIN public.reportes_horas_extras r ON d.reporte_id = r.id
        JOIN public.personal p ON d.personal_id = p.id
        JOIN public.ieds i ON r.ied_id = i.id
        WHERE r.mes = p_mes 
          AND r.año = p_anio 
          AND r.estado = 'aprobado' 
          AND (p_incluir_ya_exportados OR NOT r.exportado)
          AND d.fest_diurno > 0

        UNION ALL

        -- Concepto 8: Fest Nocturno (HEXFN)
        SELECT 
            p.cedula,
            'HEXFN'::VARCHAR(10),
            TO_CHAR(last_day, 'YYYY-MM-DD')::VARCHAR(10),
            TO_CHAR(liq_day, 'YYYY-MM-DD')::VARCHAR(10),
            d.fest_nocturno,
            i.nombre::VARCHAR(255),
            r.id
        FROM public.detalle_reporte d
        JOIN public.reportes_horas_extras r ON d.reporte_id = r.id
        JOIN public.personal p ON d.personal_id = p.id
        JOIN public.ieds i ON r.ied_id = i.id
        WHERE r.mes = p_mes 
          AND r.año = p_anio 
          AND r.estado = 'aprobado' 
          AND (p_incluir_ya_exportados OR NOT r.exportado)
          AND d.fest_nocturno > 0

        UNION ALL

        -- Concepto 9: Recargo Nocturno (RECND)
        SELECT 
            p.cedula,
            'RECND'::VARCHAR(10),
            TO_CHAR(last_day, 'YYYY-MM-DD')::VARCHAR(10),
            TO_CHAR(liq_day, 'YYYY-MM-DD')::VARCHAR(10),
            d.recargo_nocturno,
            i.nombre::VARCHAR(255),
            r.id
        FROM public.detalle_reporte d
        JOIN public.reportes_horas_extras r ON d.reporte_id = r.id
        JOIN public.personal p ON d.personal_id = p.id
        JOIN public.ieds i ON r.ied_id = i.id
        WHERE r.mes = p_mes 
          AND r.año = p_anio 
          AND r.estado = 'aprobado' 
          AND (p_incluir_ya_exportados OR NOT r.exportado)
          AND d.recargo_nocturno > 0
    ) q;

    -- Si no hay registros, lanzar excepción
    SELECT COUNT(DISTINCT t_reporte_id) INTO v_report_count FROM temp_consolidado;
    IF v_report_count = 0 THEN
        RAISE EXCEPTION 'No se encontraron reportes aprobados pendientes de exportación para el mes/año seleccionado.';
    END IF;

    -- Marcar reportes como exportados (dentro de la misma transacción)
    UPDATE public.reportes_horas_extras
    SET exportado = true
    WHERE id IN (SELECT DISTINCT t_reporte_id FROM temp_consolidado);

    -- Registrar auditoría automáticamente (dentro de la misma transacción)
    INSERT INTO public.auditoria (usuario_id, accion, tabla_afectada, registro_id, ip)
    VALUES (
        (SELECT id FROM public.usuarios WHERE auth_id = auth.uid() LIMIT 1),
        'Exportación consolidada masiva general de ' || v_report_count || ' reportes del mes ' || p_mes || '/' || p_anio,
        'reportes_horas_extras',
        NULL,
        inet_client_addr()::varchar
    );

    RETURN QUERY 
    SELECT 
        t_codempleado, 
        t_codconcepto, 
        t_fechaocurrencia, 
        t_fechaliquidacion, 
        t_valor, 
        t_centrocosto 
    FROM temp_consolidado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- TRIGGER / FUNCIONES: Cálculo automático de excede_tope basado en topes prorrateados de la IED
CREATE OR REPLACE FUNCTION public.calcular_y_actualizar_excede_tope(p_reporte_id UUID)
RETURNS VOID AS $$
DECLARE
    v_ied_id VARCHAR(12);
    v_dias_autorizados INTEGER;
    
    v_tope_residuo NUMERIC;
    v_tope_necesidades INTEGER;
    v_tope_ju INTEGER;
    v_tope_adultos INTEGER;
    
    v_sum_residuo NUMERIC;
    v_sum_sustitucion NUMERIC;
    v_sum_ju NUMERIC;
    v_sum_adultos NUMERIC;
    
    v_excede BOOLEAN := false;
BEGIN
    -- Obtener la información del reporte y de la IED
    SELECT r.ied_id,
           i.residuo, i.necesidades_docentes, i.jornada_unica, i.adultos, i.dias_autorizados
    INTO v_ied_id,
         v_tope_residuo, v_tope_necesidades, v_tope_ju, v_tope_adultos, v_dias_autorizados
    FROM public.reportes_horas_extras r
    JOIN public.ieds i ON r.ied_id = i.id
    WHERE r.id = p_reporte_id;

    IF v_ied_id IS NOT NULL AND v_dias_autorizados IS NOT NULL THEN
        -- Calcular sumas de horas extras reportadas
        SELECT 
            COALESCE(SUM(residuo), 0),
            COALESCE(SUM(sustitucion), 0),
            COALESCE(SUM(jornada_unica), 0),
            COALESCE(SUM(adultos), 0)
        INTO v_sum_residuo, v_sum_sustitucion, v_sum_ju, v_sum_adultos
        FROM public.detalle_reporte
        WHERE reporte_id = p_reporte_id;

        -- Comparar contra topes prorrateados utilizando dias_autorizados
        IF (v_sum_residuo + v_sum_sustitucion) > ((v_tope_residuo + v_tope_necesidades) / 5.0) * v_dias_autorizados OR
           v_sum_ju > (v_tope_ju / 5.0) * v_dias_autorizados OR
           v_sum_adultos > (v_tope_adultos / 5.0) * v_dias_autorizados THEN
            v_excede := true;
        END IF;
    END IF;

    -- Actualizar cabecera del reporte
    UPDATE public.reportes_horas_extras
    SET excede_tope = v_excede
    WHERE id = p_reporte_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para detalle_reporte (cambios en filas de horas)
CREATE OR REPLACE FUNCTION public.fn_trg_actualizar_excede_tope_details()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.calcular_y_actualizar_excede_tope(OLD.reporte_id);
    ELSE
        PERFORM public.calcular_y_actualizar_excede_tope(NEW.reporte_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_actualizar_excede_tope_details
AFTER INSERT OR UPDATE OR DELETE ON public.detalle_reporte
FOR EACH ROW
EXECUTE FUNCTION public.fn_trg_actualizar_excede_tope_details();

-- Trigger para reportes_horas_extras (cambios en período/mes/año)
CREATE OR REPLACE FUNCTION public.fn_trg_actualizar_excede_tope_headers()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.mes <> NEW.mes OR OLD.año <> NEW.año OR OLD.ied_id <> NEW.ied_id) THEN
        PERFORM public.calcular_y_actualizar_excede_tope(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_actualizar_excede_tope_headers
AFTER UPDATE ON public.reportes_horas_extras
FOR EACH ROW
EXECUTE FUNCTION public.fn_trg_actualizar_excede_tope_headers();
