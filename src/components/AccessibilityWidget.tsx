import React, { useState, useEffect } from 'react';

interface AccessConfig {
  fontSizeLevel: number; // 0 (100%), 1 (110%), 2 (120%), 3 (130%), 4 (140%)
  lineHeightLevel: number; // 0 (default), 1 (+20%), 2 (+40%)
  letterSpacingLevel: number; // 0 (default), 1 (+0.08em), 2 (+0.16em)
  legibleFont: boolean;
  bigCursor: boolean;
  alignLeft: boolean;
  boldFont: boolean;
  colorMode: 'default' | 'alto-contraste' | 'monocromo';
  readingLine: boolean;
  readingMask: boolean;
  hideImages: boolean;
  highlightContent: boolean;
  stopAnimations: boolean;
  highlightLinks: boolean;
}

const DEFAULT_CONFIG: AccessConfig = {
  fontSizeLevel: 0,
  lineHeightLevel: 0,
  letterSpacingLevel: 0,
  legibleFont: false,
  bigCursor: false,
  alignLeft: false,
  boldFont: false,
  colorMode: 'default',
  readingLine: false,
  readingMask: false,
  hideImages: false,
  highlightContent: false,
  stopAnimations: false,
  highlightLinks: false,
};

export const AccessibilityWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<AccessConfig>(() => {
    const saved = localStorage.getItem('accessibility_config');
    if (saved) {
      try {
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_CONFIG;
      }
    }
    return DEFAULT_CONFIG;
  });

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Seguir movimiento del mouse para las utilidades de lectura
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    if (config.readingLine || config.readingMask) {
      window.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [config.readingLine, config.readingMask]);

  // Aplicar clases del estado al DOM del Body
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    // 1. Multiplicador de Fuente
    const fontSizes = ['100%', '110%', '120%', '130%', '140%'];
    html.style.fontSize = fontSizes[config.fontSizeLevel];

    // 2. Altura de Línea
    body.classList.remove('line-height-2', 'line-height-3');
    if (config.lineHeightLevel === 1) body.classList.add('line-height-2');
    if (config.lineHeightLevel === 2) body.classList.add('line-height-3');

    // 3. Espaciado de Letras
    body.classList.remove('letter-spacing-2', 'letter-spacing-3');
    if (config.letterSpacingLevel === 1) body.classList.add('letter-spacing-2');
    if (config.letterSpacingLevel === 2) body.classList.add('letter-spacing-3');

    // 4. Modos de Color
    body.classList.remove('alto-contraste', 'monocromo');
    if (config.colorMode === 'alto-contraste') body.classList.add('alto-contraste');
    if (config.colorMode === 'monocromo') body.classList.add('monocromo');

    // 5. Toggles visuales
    body.classList.toggle('fuente-legible', config.legibleFont);
    body.classList.toggle('big-cursor', config.bigCursor);
    body.classList.toggle('force-align-left', config.alignLeft);
    body.classList.toggle('force-bold', config.boldFont);
    body.classList.toggle('hide-images', config.hideImages);
    body.classList.toggle('highlight-content', config.highlightContent);
    body.classList.toggle('stop-animations', config.stopAnimations);
    body.classList.toggle('highlight-links', config.highlightLinks);

    // Guardar en localStorage
    localStorage.setItem('accessibility_config', JSON.stringify(config));
  }, [config]);

  // Restablecer todas las configuraciones
  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
  };

  const updateConfig = <K extends keyof AccessConfig>(key: K, value: AccessConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const getFontSizeLabel = () => {
    if (config.fontSizeLevel === 0) return 'Predeterminado';
    return `+${config.fontSizeLevel * 10}%`;
  };

  const getLineHeightLabel = () => {
    if (config.lineHeightLevel === 0) return 'Predeterminado';
    if (config.lineHeightLevel === 1) return '+20%';
    return '+40%';
  };

  return (
    <>
      {/* Botón Flotante (Esquina inferior izquierda) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="accessibility-widget-btn fixed bottom-6 left-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 z-[9999] cursor-pointer"
        aria-label="Ajustes de Accesibilidad"
        title="Menú de Accesibilidad"
      >
        <span className="material-symbols-outlined text-[32px] select-none">accessibility</span>
      </button>

      {/* Panel de Accesibilidad */}
      {isOpen && (
        <div className="accessibility-widget-panel fixed bottom-24 left-6 w-[420px] max-w-[calc(100vw-48px)] bg-surface border border-outline-variant/60 rounded-3xl shadow-2xl overflow-hidden z-[9999] flex flex-col font-sans max-h-[75vh] animate-fadeIn select-none">
          
          {/* Header del Panel */}
          <div className="bg-blue-600 text-white p-6 relative flex flex-col items-center text-center gap-3">
            
            {/* Fila superior: Cerrar */}
            <div className="w-full flex justify-end items-center text-xs">
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Cerrar Ajustes de Accesibilidad"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Icono Grande */}
            <div className="w-14 h-14 bg-white text-blue-600 rounded-full flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-[36px]">accessibility</span>
            </div>

            {/* Título */}
            <div>
              <h2 className="text-lg font-bold">Ajustes de Accesibilidad</h2>
              <button 
                onClick={handleReset}
                className="text-[11px] font-bold text-white/80 hover:text-white underline mt-1 block mx-auto cursor-pointer"
              >
                Restablecer barra de herramientas
              </button>
            </div>
          </div>

          {/* Cuerpo Desplazable del Panel */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50/50">
            
            {/* 1. Módulos de Contenido */}
            <div className="space-y-3">
              <h3 className="text-xs font-black text-on-surface-variant uppercase tracking-wider">Módulos de contenido</h3>
              
              <div className="grid grid-cols-2 gap-3">
                
                {/* Tamaño de fuente */}
                <div className="col-span-2 bg-white border border-outline-variant/40 rounded-2xl p-4 flex flex-col items-center justify-center gap-2.5 shadow-sm">
                  <span className="text-xs font-bold text-on-surface-variant">Tamaño de fuente</span>
                  <div className="flex items-center gap-4 w-full justify-between px-2">
                    <button
                      onClick={() => config.fontSizeLevel > 0 && updateConfig('fontSizeLevel', config.fontSizeLevel - 1)}
                      disabled={config.fontSizeLevel === 0}
                      className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-blue-600 disabled:opacity-40 disabled:hover:bg-slate-100 flex items-center justify-center font-bold text-lg select-none cursor-pointer"
                      aria-label="Reducir tamaño de fuente"
                    >
                      —
                    </button>
                    <span className="text-xs font-black text-on-surface">{getFontSizeLabel()}</span>
                    <button
                      onClick={() => config.fontSizeLevel < 4 && updateConfig('fontSizeLevel', config.fontSizeLevel + 1)}
                      disabled={config.fontSizeLevel === 4}
                      className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:hover:bg-blue-600 flex items-center justify-center font-bold text-lg select-none cursor-pointer"
                      aria-label="Aumentar tamaño de fuente"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Fuente legible */}
                <button
                  onClick={() => updateConfig('legibleFont', !config.legibleFont)}
                  className={`bg-white border rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm text-center cursor-pointer transition-all hover:border-blue-600/30 ${config.legibleFont ? 'border-blue-600 ring-1 ring-blue-600' : 'border-outline-variant/40'}`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${config.legibleFont ? 'bg-blue-600 text-white' : 'bg-slate-100 text-on-surface-variant'}`}>
                    <span className="material-symbols-outlined text-[20px]">font_download</span>
                  </div>
                  <span className="text-xs font-bold text-on-surface">Fuente legible</span>
                </button>

                {/* Cursor Grande */}
                <button
                  onClick={() => updateConfig('bigCursor', !config.bigCursor)}
                  className={`bg-white border rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm text-center cursor-pointer transition-all hover:border-blue-600/30 ${config.bigCursor ? 'border-blue-600 ring-1 ring-blue-600' : 'border-outline-variant/40'}`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${config.bigCursor ? 'bg-blue-600 text-white' : 'bg-slate-100 text-on-surface-variant'}`}>
                    <span className="material-symbols-outlined text-[20px]">near_me</span>
                  </div>
                  <span className="text-xs font-bold text-on-surface">Cursor grande</span>
                </button>

                {/* Altura de línea */}
                <div className="bg-white border border-outline-variant/40 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm text-center">
                  <span className="text-xs font-bold text-on-surface-variant">Altura de línea</span>
                  <div className="flex items-center gap-3 mt-1">
                    <button
                      onClick={() => config.lineHeightLevel > 0 && updateConfig('lineHeightLevel', config.lineHeightLevel - 1)}
                      disabled={config.lineHeightLevel === 0}
                      className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-blue-600 disabled:opacity-40 flex items-center justify-center font-bold cursor-pointer"
                      aria-label="Reducir altura de línea"
                    >
                      —
                    </button>
                    <span className="text-[11px] font-black text-on-surface min-w-[36px]">{getLineHeightLabel()}</span>
                    <button
                      onClick={() => config.lineHeightLevel < 2 && updateConfig('lineHeightLevel', config.lineHeightLevel + 1)}
                      disabled={config.lineHeightLevel === 2}
                      className="w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 flex items-center justify-center font-bold cursor-pointer"
                      aria-label="Aumentar altura de línea"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Espaciado de letras */}
                <div className="bg-white border border-outline-variant/40 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm text-center">
                  <span className="text-xs font-bold text-on-surface-variant">Espaciado letras</span>
                  <div className="flex items-center gap-3 mt-1">
                    <button
                      onClick={() => config.letterSpacingLevel > 0 && updateConfig('letterSpacingLevel', config.letterSpacingLevel - 1)}
                      disabled={config.letterSpacingLevel === 0}
                      className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-blue-600 disabled:opacity-40 flex items-center justify-center font-bold cursor-pointer"
                      aria-label="Reducir espaciado de letras"
                    >
                      —
                    </button>
                    <span className="text-[11px] font-black text-on-surface min-w-[36px]">
                      {config.letterSpacingLevel === 0 ? 'Normal' : config.letterSpacingLevel === 1 ? '+8%' : '+16%'}
                    </span>
                    <button
                      onClick={() => config.letterSpacingLevel < 2 && updateConfig('letterSpacingLevel', config.letterSpacingLevel + 1)}
                      disabled={config.letterSpacingLevel === 2}
                      className="w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 flex items-center justify-center font-bold cursor-pointer"
                      aria-label="Aumentar espaciado de letras"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Alinear texto a la izquierda */}
                <button
                  onClick={() => updateConfig('alignLeft', !config.alignLeft)}
                  className={`bg-white border rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm text-center cursor-pointer transition-all hover:border-blue-600/30 ${config.alignLeft ? 'border-blue-600 ring-1 ring-blue-600' : 'border-outline-variant/40'}`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${config.alignLeft ? 'bg-blue-600 text-white' : 'bg-slate-100 text-on-surface-variant'}`}>
                    <span className="material-symbols-outlined text-[20px]">align_horizontal_left</span>
                  </div>
                  <span className="text-xs font-bold text-on-surface">Alinear texto</span>
                </button>

                {/* Grosor de fuente (Bold) */}
                <button
                  onClick={() => updateConfig('boldFont', !config.boldFont)}
                  className={`bg-white border rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm text-center cursor-pointer transition-all hover:border-blue-600/30 ${config.boldFont ? 'border-blue-600 ring-1 ring-blue-600' : 'border-outline-variant/40'}`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${config.boldFont ? 'bg-blue-600 text-white' : 'bg-slate-100 text-on-surface-variant'}`}>
                    <span className="material-symbols-outlined text-[20px]">format_bold</span>
                  </div>
                  <span className="text-xs font-bold text-on-surface">Grosor de fuente</span>
                </button>

              </div>
            </div>

            {/* 2. Módulos de Color */}
            <div className="space-y-3">
              <h3 className="text-xs font-black text-on-surface-variant uppercase tracking-wider">Módulos de color</h3>
              
              <div className="grid grid-cols-3 gap-2">
                
                {/* Contraste claro */}
                <button
                  onClick={() => updateConfig('colorMode', 'default')}
                  className={`bg-white border rounded-2xl p-3.5 flex flex-col items-center justify-center gap-2 shadow-sm text-center cursor-pointer transition-all hover:border-blue-600/30 ${config.colorMode === 'default' ? 'border-blue-600 ring-1 ring-blue-600' : 'border-outline-variant/40'}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${config.colorMode === 'default' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-on-surface-variant'}`}>
                    <span className="material-symbols-outlined text-[18px]">light_mode</span>
                  </div>
                  <span className="text-[10px] font-bold text-on-surface">Claro</span>
                </button>

                {/* Alto Contraste */}
                <button
                  onClick={() => updateConfig('colorMode', 'alto-contraste')}
                  className={`bg-white border rounded-2xl p-3.5 flex flex-col items-center justify-center gap-2 shadow-sm text-center cursor-pointer transition-all hover:border-blue-600/30 ${config.colorMode === 'alto-contraste' ? 'border-blue-600 ring-1 ring-blue-600' : 'border-outline-variant/40'}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${config.colorMode === 'alto-contraste' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-on-surface-variant'}`}>
                    <span className="material-symbols-outlined text-[18px]">contrast</span>
                  </div>
                  <span className="text-[10px] font-bold text-on-surface">Alto contraste</span>
                </button>

                {/* Monocromo */}
                <button
                  onClick={() => updateConfig('colorMode', 'monocromo')}
                  className={`bg-white border rounded-2xl p-3.5 flex flex-col items-center justify-center gap-2 shadow-sm text-center cursor-pointer transition-all hover:border-blue-600/30 ${config.colorMode === 'monocromo' ? 'border-blue-600 ring-1 ring-blue-600' : 'border-outline-variant/40'}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${config.colorMode === 'monocromo' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-on-surface-variant'}`}>
                    <span className="material-symbols-outlined text-[18px]">filter_b_and_w</span>
                  </div>
                  <span className="text-[10px] font-bold text-on-surface">Monocromo</span>
                </button>

              </div>
            </div>

            {/* 3. Módulos de Orientación */}
            <div className="space-y-3">
              <h3 className="text-xs font-black text-on-surface-variant uppercase tracking-wider">Módulos de orientación</h3>
              
              <div className="grid grid-cols-2 gap-3">
                
                {/* Línea de lectura */}
                <button
                  onClick={() => updateConfig('readingLine', !config.readingLine)}
                  className={`bg-white border rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm text-center cursor-pointer transition-all hover:border-blue-600/30 ${config.readingLine ? 'border-blue-600 ring-1 ring-blue-600' : 'border-outline-variant/40'}`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${config.readingLine ? 'bg-blue-600 text-white' : 'bg-slate-100 text-on-surface-variant'}`}>
                    <span className="material-symbols-outlined text-[20px]">horizontal_rule</span>
                  </div>
                  <span className="text-xs font-bold text-on-surface">Línea de lectura</span>
                </button>

                {/* Máscara de lectura */}
                <button
                  onClick={() => updateConfig('readingMask', !config.readingMask)}
                  className={`bg-white border rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm text-center cursor-pointer transition-all hover:border-blue-600/30 ${config.readingMask ? 'border-blue-600 ring-1 ring-blue-600' : 'border-outline-variant/40'}`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${config.readingMask ? 'bg-blue-600 text-white' : 'bg-slate-100 text-on-surface-variant'}`}>
                    <span className="material-symbols-outlined text-[20px]">vertical_distribute</span>
                  </div>
                  <span className="text-xs font-bold text-on-surface">Máscara de lectura</span>
                </button>

                {/* Ocultar imágenes */}
                <button
                  onClick={() => updateConfig('hideImages', !config.hideImages)}
                  className={`bg-white border rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm text-center cursor-pointer transition-all hover:border-blue-600/30 ${config.hideImages ? 'border-blue-600 ring-1 ring-blue-600' : 'border-outline-variant/40'}`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${config.hideImages ? 'bg-blue-600 text-white' : 'bg-slate-100 text-on-surface-variant'}`}>
                    <span className="material-symbols-outlined text-[20px]">hide_image</span>
                  </div>
                  <span className="text-xs font-bold text-on-surface">Ocultar imágenes</span>
                </button>

                {/* Resaltar contenido */}
                <button
                  onClick={() => updateConfig('highlightContent', !config.highlightContent)}
                  className={`bg-white border rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm text-center cursor-pointer transition-all hover:border-blue-600/30 ${config.highlightContent ? 'border-blue-600 ring-1 ring-blue-600' : 'border-outline-variant/40'}`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${config.highlightContent ? 'bg-blue-600 text-white' : 'bg-slate-100 text-on-surface-variant'}`}>
                    <span className="material-symbols-outlined text-[20px]">select_all</span>
                  </div>
                  <span className="text-xs font-bold text-on-surface">Resaltar contenido</span>
                </button>

                {/* Detener animaciones */}
                <button
                  onClick={() => updateConfig('stopAnimations', !config.stopAnimations)}
                  className={`bg-white border rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm text-center cursor-pointer transition-all hover:border-blue-600/30 ${config.stopAnimations ? 'border-blue-600 ring-1 ring-blue-600' : 'border-outline-variant/40'}`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${config.stopAnimations ? 'bg-blue-600 text-white' : 'bg-slate-100 text-on-surface-variant'}`}>
                    <span className="material-symbols-outlined text-[20px]">motion_photos_off</span>
                  </div>
                  <span className="text-xs font-bold text-on-surface">Detener animaciones</span>
                </button>

                {/* Resaltar enlaces */}
                <button
                  onClick={() => updateConfig('highlightLinks', !config.highlightLinks)}
                  className={`bg-white border rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm text-center cursor-pointer transition-all hover:border-blue-600/30 ${config.highlightLinks ? 'border-blue-600 ring-1 ring-blue-600' : 'border-outline-variant/40'}`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${config.highlightLinks ? 'bg-blue-600 text-white' : 'bg-slate-100 text-on-surface-variant'}`}>
                    <span className="material-symbols-outlined text-[20px]">link</span>
                  </div>
                  <span className="text-xs font-bold text-on-surface">Resaltar enlaces</span>
                </button>

              </div>
            </div>

          </div>

        </div>
      )}

      {/* --- SOBRECAPAS EN TIEMPO REAL (LÍNEA / MÁSCARA DE LECTURA) --- */}

      {/* Línea de lectura */}
      {config.readingLine && (
        <div 
          className="pointer-events-none fixed left-0 w-full h-[3px] bg-red-600 z-[99999]"
          style={{ top: `${mousePos.y}px` }}
        />
      )}

      {/* Máscara de lectura */}
      {config.readingMask && (
        <>
          <div 
            className="pointer-events-none fixed left-0 right-0 top-0 bg-black/60 z-[99998]"
            style={{ height: `${Math.max(0, mousePos.y - 50)}px` }}
          />
          <div 
            className="pointer-events-none fixed left-0 right-0 bottom-0 bg-black/60 z-[99998]"
            style={{ top: `${mousePos.y + 50}px` }}
          />
        </>
      )}
    </>
  );
};
