import React, { useState, useMemo, useEffect } from 'react';
import { rectorService } from '../services/rectorService';
import type { RectorRecord, IedOption } from '../services/rectorService';
import { useAlert } from '../contexts/AlertContext';
import { enmascararNombre } from '../utils/mask';

export const Rectors: React.FC = () => {
  const { showAlert } = useAlert();
  const [rectors, setRectors] = useState<RectorRecord[]>([]);
  const [iedOptions, setIedOptions] = useState<IedOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRector, setEditingRector] = useState<RectorRecord | null>(null);
  
  // Form input states
  const [formCedula, setFormCedula] = useState('');
  const [formName, setFormName] = useState('');
  const [formEmailUsername, setFormEmailUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formIedId, setFormIedId] = useState('');
  const [iedSearch, setIedSearch] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [isIedDropdownOpen, setIsIedDropdownOpen] = useState(false);

  const filteredIedOptions = useMemo(() => {
    const q = iedSearch.toLowerCase().trim();
    if (!q) return iedOptions;
    return iedOptions.filter(opt => 
      opt.id === formIedId || 
      opt.nombre.toLowerCase().includes(q) || 
      opt.id.includes(q)
    );
  }, [iedOptions, iedSearch, formIedId]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Tab control state
  const [activeTab, setActiveTab] = useState<'rectores' | 'ieds'>('rectores');
  
  // IED search query and pagination
  const [iedSearchQuery, setIedSearchQuery] = useState('');
  const [iedCurrentPage, setIedCurrentPage] = useState(1);
  const iedsPerPage = 8;
  
  // IED edit dias modal states
  const [isIedModalOpen, setIsIedModalOpen] = useState(false);
  const [selectedIed, setSelectedIed] = useState<IedOption | null>(null);
  const [editDiasValue, setEditDiasValue] = useState<string>('');

  useEffect(() => {
    if (isModalOpen || isIedModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen, isIedModalOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rectorsList, iedsList] = await Promise.all([
        rectorService.getRectors(),
        rectorService.getIeds()
      ]);
      setRectors(rectorsList);
      setIedOptions(iedsList);
    } catch (err: any) {
      console.error(err);
      showAlert('error', 'Error de Carga', 'No se pudieron cargar los datos del servidor: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter rectors based on query
  const filteredRectors = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return rectors;
    return rectors.filter(rector => 
      rector.nombre.toLowerCase().includes(query) ||
      rector.correo_institucional.toLowerCase().includes(query) ||
      rector.cedula.includes(query) ||
      (rector.ied_nombre && rector.ied_nombre.toLowerCase().includes(query))
    );
  }, [rectors, searchQuery]);

  // Paginated records
  const paginatedRectors = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredRectors.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRectors, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredRectors.length / itemsPerPage));

  // Filter IEDs based on query
  const filteredIeds = useMemo(() => {
    const query = iedSearchQuery.toLowerCase().trim();
    if (!query) return iedOptions;
    return iedOptions.filter(ied => 
      ied.nombre.toLowerCase().includes(query) ||
      ied.id.includes(query)
    );
  }, [iedOptions, iedSearchQuery]);

  // Paginated IEDs
  const paginatedIeds = useMemo(() => {
    const start = (iedCurrentPage - 1) * iedsPerPage;
    return filteredIeds.slice(start, start + iedsPerPage);
  }, [filteredIeds, iedCurrentPage]);

  const totalIedPages = Math.max(1, Math.ceil(filteredIeds.length / iedsPerPage));

  const handleOpenIedEditModal = (ied: IedOption) => {
    setSelectedIed(ied);
    setEditDiasValue(ied.dias_autorizados !== null ? String(ied.dias_autorizados) : '');
    setIsIedModalOpen(true);
  };

  const handleSaveIedDias = async () => {
    if (!selectedIed) return;
    const diasVal = editDiasValue.trim();
    const parsedDias = diasVal === '' ? null : parseInt(diasVal);
    
    if (parsedDias !== null && (isNaN(parsedDias) || parsedDias < 0)) {
      showAlert('warning', 'Validación', 'Por favor, ingrese un número válido de días autorizados (mayor o igual a 0).');
      return;
    }
    
    setSubmitting(true);
    try {
      await rectorService.updateIedDiasAutorizados(selectedIed.id, parsedDias);
      showAlert('success', 'Guardado Exitoso', `Días autorizados actualizados correctamente para la institución.`);
      setIsIedModalOpen(false);
      setSelectedIed(null);
      await loadData();
    } catch (err: any) {
      console.error(err);
      showAlert('error', 'Error al Guardar', 'No se pudieron actualizar los días autorizados: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Open modal for creation
  const handleOpenCreateModal = () => {
    setEditingRector(null);
    setFormCedula('');
    setFormName('');
    setFormEmailUsername('');
    setFormPassword('');
    setFormIedId('');
    setIedSearch('');
    setIsIedDropdownOpen(false);
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  // Open modal for editing
  const handleOpenEditModal = (rector: RectorRecord) => {
    setEditingRector(rector);
    setFormCedula(rector.cedula);
    setFormName(rector.nombre);
    const username = rector.correo_institucional.split('@')[0];
    setFormEmailUsername(username);
    setFormPassword(''); // Not editing password here
    setFormIedId(rector.ied_id);
    setIedSearch('');
    setIsIedDropdownOpen(false);
    setFormIsActive(rector.activo);
    setIsModalOpen(true);
  };

  // Toggle rector status (activar/desactivar)
  const handleToggleStatus = (rector: RectorRecord) => {
    showAlert(
      'warning',
      'Confirmar Acción',
      `¿Está seguro de que desea ${rector.activo ? 'DESACTIVAR' : 'ACTIVAR'} al rector ${rector.nombre}?`,
      async () => {
        try {
          await rectorService.updateRector(rector.id, { activo: !rector.activo });
          setRectors(prev => 
            prev.map(r => r.id === rector.id ? { ...r, activo: !r.activo } : r)
          );
          showAlert('success', 'Estado Actualizado', `El rector ha sido ${rector.activo ? 'desactivado' : 'activado'} con éxito.`);
        } catch (err: any) {
          showAlert('error', 'Error de Estado', 'Error al cambiar estado del rector: ' + err.message);
        }
      },
      true
    );
  };

  // Form submission handler
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formCedula.trim() || !/^[0-9]+$/.test(formCedula.trim())) {
      showAlert('warning', 'Validación', 'Por favor ingrese una cédula válida (solo números).');
      return;
    }
    if (!formName.trim()) {
      showAlert('warning', 'Validación', 'Por favor ingrese el nombre completo.');
      return;
    }
    if (!formEmailUsername.trim()) {
      showAlert('warning', 'Validación', 'Por favor ingrese la parte del usuario del correo institucional.');
      return;
    }
    if (!editingRector && !formPassword.trim()) {
      showAlert('warning', 'Validación', 'Por favor ingrese una contraseña inicial para el rector.');
      return;
    }
    if (!formIedId) {
      showAlert('warning', 'Validación', 'Por favor seleccione una IED.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingRector) {
        // Editing
        await rectorService.updateRector(editingRector.id, {
          nombre: formName.trim(),
          ied_id: formIedId,
          activo: formIsActive
        });
        showAlert('success', 'Rector Actualizado', 'Rector actualizado con éxito.');
      } else {
        // Crear rector de forma automática (haciendo signUp en background sin cambiar sesión activa)
        await rectorService.crearRector(
          formCedula.trim(),
          formName.trim(),
          formEmailUsername.trim(),
          formPassword.trim(),
          formIedId
        );
        showAlert('success', 'Registro Exitoso', 'Rector registrado con éxito (se le forzará a cambiar la clave al ingresar).');
      }
      setIsModalOpen(false);
      // Reload lists
      await loadData();
    } catch (err: any) {
      console.error(err);
      showAlert('error', 'Error al Guardar', 'Error al guardar rector: ' + (err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeIn relative font-sans">
      
      {/* Upper Action Bar with Tab Selectors */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-outline-variant/40 select-none">
        <div className="space-y-1">
          <h2 className="text-xl md:text-2xl font-bold text-primary font-sans">Gestión de Instituciones y Directivos</h2>
          <p className="text-xs text-on-surface-variant leading-relaxed max-w-2xl">
            Administración central del personal de rectores autorizados y de las Instituciones Educativas Departamentales (IED), incluyendo la configuración de días autorizados por resolución.
          </p>
        </div>
        {activeTab === 'rectores' && (
          <button 
            onClick={handleOpenCreateModal}
            className="bg-primary hover:bg-[#002f6c] text-on-primary px-5 py-2.5 rounded-xl font-semibold text-xs md:text-sm transition-colors shadow-sm flex items-center gap-2 shrink-0 active:scale-[0.98]"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_add</span>
            Crear rector
          </button>
        )}
      </div>

      {/* Tabs selectors */}
      <div className="flex border-b border-outline-variant/30 select-none -mt-4 bg-surface-container-lowest rounded-xl p-1 shadow-sm gap-1 self-start">
        <button
          onClick={() => {
            setActiveTab('rectores');
            setSearchQuery('');
          }}
          className={`px-5 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 ${
            activeTab === 'rectores'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-outline hover:text-on-surface hover:bg-surface-container-low'
          }`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>supervisor_account</span>
          Directivos / Rectores
        </button>
        <button
          onClick={() => {
            setActiveTab('ieds');
            setIedSearchQuery('');
            setIedCurrentPage(1);
          }}
          className={`px-5 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 ${
            activeTab === 'ieds'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-outline hover:text-on-surface hover:bg-surface-container-low'
          }`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>school</span>
          Configuración de IEDs
        </button>
      </div>

      {activeTab === 'rectores' ? (
        /* ================== TAB: RECTORES ================== */
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.015)] animate-fadeIn">
          {/* Table Header Filter / Search */}
          <div className="p-6 border-b border-outline-variant/50 flex flex-col sm:flex-row justify-between items-center gap-4 bg-surface-container-lowest">
            <h3 className="text-base font-bold text-primary select-none">Usuarios Rectores Registrados</h3>
            <div className="relative w-full sm:w-64">
              <span className="material-symbols-outlined absolute left-3.5 top-3 text-on-surface-variant text-sm select-none">search</span>
              <input 
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-outline-variant rounded-xl text-xs md:text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-outline/50" 
                placeholder="Buscar por nombre, IED, CC o correo..." 
                type="text"
              />
            </div>
          </div>

          {/* Table View */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
                <span className="text-sm font-medium text-on-surface-variant">Cargando rectores de nómina...</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-low/60 border-b border-outline-variant/80 select-none">
                  <tr>
                    <th className="py-3 px-6 font-semibold text-xs md:text-sm text-on-surface-variant whitespace-nowrap">Documento / Cédula</th>
                    <th className="py-3 px-6 font-semibold text-xs md:text-sm text-on-surface-variant whitespace-nowrap">Nombre Completo</th>
                    <th className="py-3 px-6 font-semibold text-xs md:text-sm text-on-surface-variant whitespace-nowrap">Correo Institucional</th>
                    <th className="py-3 px-6 font-semibold text-xs md:text-sm text-on-surface-variant min-w-[200px]">IED Asignada (DANE)</th>
                    <th className="py-3 px-6 font-semibold text-xs md:text-sm text-on-surface-variant">Estado</th>
                    <th className="py-3 px-6 font-semibold text-xs md:text-sm text-on-surface-variant text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40 text-xs md:text-sm text-on-surface">
                  {paginatedRectors.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-on-surface-variant font-medium">
                        No se encontraron rectores registrados.
                      </td>
                    </tr>
                  ) : (
                    paginatedRectors.map((rector) => (
                      <tr key={rector.id} className="hover:bg-surface-container-lowest/50 transition-colors">
                        <td className="py-4 px-6 font-mono text-on-surface-variant font-medium">
                          {rector.cedula}
                        </td>
                        <td className="py-4 px-6 font-bold text-primary">
                          {enmascararNombre(rector.nombre)}
                        </td>
                        <td className="py-4 px-6 text-on-surface-variant font-medium">
                          {rector.correo_institucional}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex flex-col">
                            <span className="font-semibold text-on-surface">{rector.ied_nombre}</span>
                            <span className="text-[10px] text-on-surface-variant font-mono mt-0.5">DANE: {rector.ied_id}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 select-none">
                          <span className={`inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-semibold border ${
                            rector.activo 
                              ? 'bg-green-50 text-green-700 border-green-200' 
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${rector.activo ? 'bg-green-600' : 'bg-red-600'}`}></span>
                            {rector.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right select-none">
                          <div className="inline-flex gap-2">
                            <button 
                              onClick={() => handleOpenEditModal(rector)}
                              className="p-1.5 hover:bg-surface-container rounded-lg text-secondary transition-colors"
                              title="Editar rector"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                            </button>
                            <button 
                              onClick={() => handleToggleStatus(rector)}
                              className={`p-1.5 hover:bg-surface-container rounded-lg transition-colors ${
                                rector.activo ? 'text-error hover:text-error/85' : 'text-green-700 hover:text-green-700/85'
                              }`}
                              title={rector.activo ? 'Desactivar rector' : 'Activar rector'}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                                {rector.activo ? 'block' : 'check_circle'}
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Footer */}
          {!loading && filteredRectors.length > 0 && (
            <div className="p-5 border-t border-outline-variant/60 flex justify-between items-center select-none bg-surface-container-lowest">
              <span className="text-[11px] md:text-xs text-on-surface-variant font-medium">
                Mostrando {paginatedRectors.length} de {filteredRectors.length} rectores
              </span>
              <div className="flex gap-2">
                <button 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                >
                  Anterior
                </button>
                <button 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-3 py-1.5 border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ================== TAB: IEDs ================== */
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.015)] animate-fadeIn">
          {/* Table Header Filter / Search */}
          <div className="p-6 border-b border-outline-variant/50 flex flex-col sm:flex-row justify-between items-center gap-4 bg-surface-container-lowest">
            <h3 className="text-base font-bold text-primary select-none">Instituciones Educativas (DANE)</h3>
            <div className="relative w-full sm:w-64">
              <span className="material-symbols-outlined absolute left-3.5 top-3 text-on-surface-variant text-sm select-none">search</span>
              <input 
                value={iedSearchQuery}
                onChange={(e) => {
                  setIedSearchQuery(e.target.value);
                  setIedCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-outline-variant rounded-xl text-xs md:text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-outline/50" 
                placeholder="Buscar por nombre o código DANE..." 
                type="text"
              />
            </div>
          </div>

          {/* Table View */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
                <span className="text-sm font-medium text-on-surface-variant">Cargando IEDs de nómina...</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-low/60 border-b border-outline-variant/80 select-none">
                  <tr>
                    <th className="py-3 px-6 font-semibold text-xs md:text-sm text-on-surface-variant whitespace-nowrap">Código DANE</th>
                    <th className="py-3 px-6 font-semibold text-xs md:text-sm text-on-surface-variant">Nombre de Institución</th>
                    <th className="py-3 px-4 font-semibold text-[11px] text-on-surface-variant text-center whitespace-nowrap">Base Residuo</th>
                    <th className="py-3 px-4 font-semibold text-[11px] text-on-surface-variant text-center whitespace-nowrap">Base Nec. Docentes</th>
                    <th className="py-3 px-4 font-semibold text-[11px] text-on-surface-variant text-center whitespace-nowrap">Base Jornada Única</th>
                    <th className="py-3 px-4 font-semibold text-[11px] text-on-surface-variant text-center whitespace-nowrap">Base Adultos</th>
                    <th className="py-3 px-4 font-semibold text-xs md:text-sm text-on-surface-variant text-center whitespace-nowrap bg-slate-50/50">Días Autorizados</th>
                    <th className="py-3 px-4 font-semibold text-xs md:text-sm text-primary text-center whitespace-nowrap bg-primary/5">Tope Mensual Real</th>
                    <th className="py-3 px-6 font-semibold text-xs md:text-sm text-on-surface-variant text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40 text-xs md:text-sm text-on-surface">
                  {paginatedIeds.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-10 text-center text-on-surface-variant font-medium">
                        No se encontraron instituciones registradas.
                      </td>
                    </tr>
                  ) : (
                    paginatedIeds.map((ied) => (
                      <tr key={ied.id} className="hover:bg-surface-container-lowest/50 transition-colors">
                        <td className="py-4 px-6 font-mono text-on-surface-variant font-medium">
                          {ied.id}
                        </td>
                        <td className="py-4 px-6 font-bold text-primary">
                          {ied.nombre}
                        </td>
                        <td className="py-4 px-4 text-center font-medium text-slate-600">
                          {ied.residuo}
                        </td>
                        <td className="py-4 px-4 text-center font-medium text-slate-600">
                          {ied.necesidades_docentes}
                        </td>
                        <td className="py-4 px-4 text-center font-medium text-slate-600">
                          {ied.jornada_unica}
                        </td>
                        <td className="py-4 px-4 text-center font-medium text-slate-600">
                          {ied.adultos}
                        </td>
                        <td className="py-4 px-4 text-center font-bold text-secondary bg-slate-50/30">
                          {ied.dias_autorizados !== null ? (
                            <span className="bg-secondary/10 px-2.5 py-1.5 rounded-lg border border-secondary/20">
                              {ied.dias_autorizados} días
                            </span>
                          ) : (
                            <span className="text-amber-600 text-[11px] font-medium bg-amber-50 border border-amber-200/50 px-2 py-1 rounded-lg">
                              Sin Configurar
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center font-bold text-primary bg-primary/5">
                          {ied.dias_autorizados !== null ? (
                            <span>{Math.round(((ied.total_he || 0) / 5) * ied.dias_autorizados * 100) / 100}h</span>
                          ) : (
                            <span className="text-outline text-[11px] font-medium">Sin configurar</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right select-none">
                          <button 
                            onClick={() => handleOpenIedEditModal(ied)}
                            className="px-3 py-1.5 bg-primary/5 hover:bg-primary hover:text-white rounded-lg text-primary text-xs font-bold transition-all flex items-center gap-1.5 ml-auto border border-primary/20 active:scale-[0.98]"
                            title="Configurar días autorizados"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>settings</span>
                            Configurar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* IED Pagination Footer */}
          {!loading && filteredIeds.length > 0 && (
            <div className="p-5 border-t border-outline-variant/60 flex justify-between items-center select-none bg-surface-container-lowest">
              <span className="text-[11px] md:text-xs text-on-surface-variant font-medium">
                Mostrando {paginatedIeds.length} de {filteredIeds.length} instituciones
              </span>
              <div className="flex gap-2">
                <button 
                  disabled={iedCurrentPage === 1}
                  onClick={() => setIedCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                >
                  Anterior
                </button>
                <button 
                  disabled={iedCurrentPage === totalIedPages}
                  onClick={() => setIedCurrentPage(prev => Math.min(totalIedPages, prev + 1))}
                  className="px-3 py-1.5 border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal/Drawer Backdrop */}
      {isModalOpen && (
        <div 
          onClick={() => { if (!submitting) setIsModalOpen(false); }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90] flex justify-end animate-fadeIn"
        >
          {/* Drawer Panel content */}
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="bg-surface w-full max-w-md h-full shadow-2xl flex flex-col z-[100] border-l border-outline-variant/60 animate-slideLeft"
          >
            
            {/* Drawer Header */}
            <div className="p-6 border-b border-outline-variant/60 flex justify-between items-center select-none bg-surface-container-lowest">
              <h2 className="text-lg font-bold text-primary">
                {editingRector ? 'Editar rector' : 'Crear nuevo rector'}
              </h2>
              <button 
                disabled={submitting}
                onClick={() => setIsModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-2 rounded-full hover:bg-surface-container transition-colors disabled:opacity-55"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Drawer Body Form */}
            <div className="p-6 flex-1 overflow-y-auto bg-surface-bright">
              <form onSubmit={handleSaveUser} className="flex flex-col gap-6">
                
                {/* Document/Cedula input */}
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-2">
                    Cédula / Documento
                  </label>
                  <input 
                    value={formCedula}
                    onChange={(e) => setFormCedula(e.target.value)}
                    required
                    disabled={!!editingRector || submitting}
                    className="w-full px-4 py-3 border border-outline-variant rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-outline/40 disabled:bg-surface-container disabled:text-on-surface-variant" 
                    placeholder="Ej: 1082345678" 
                    type="text"
                  />
                </div>

                {/* Full name input */}
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-2">
                    Nombre Completo
                  </label>
                  <input 
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    disabled={submitting}
                    className="w-full px-4 py-3 border border-outline-variant rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-outline/40 disabled:bg-surface-container" 
                    placeholder="Ej: Ana Martínez Ríos" 
                    type="text"
                  />
                </div>

                {/* Email input */}
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-2">
                    Correo Institucional
                  </label>
                  <div className="relative flex items-stretch border border-outline-variant rounded-xl focus-within:border-primary focus-within:ring-1 focus-within:ring-primary overflow-hidden bg-surface transition-all duration-200">
                    <input 
                      value={formEmailUsername}
                      onChange={(e) => setFormEmailUsername(e.target.value)}
                      required
                      disabled={!!editingRector || submitting}
                      className="flex-1 bg-transparent border-none py-3 pl-4 pr-3 text-sm focus:ring-0 placeholder:text-outline/40 outline-none disabled:text-on-surface-variant" 
                      placeholder="usuario" 
                      type="text"
                    />
                    <span className="flex items-center px-4 bg-surface-container-high border-l border-outline-variant text-on-surface-variant font-semibold text-xs select-none whitespace-nowrap">
                      @sedmagdalena.gov.co
                    </span>
                  </div>
                </div>

                {/* Password input - Only for creation */}
                {!editingRector && (
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-2">
                      Contraseña Inicial del Rector
                    </label>
                    <input 
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      required
                      disabled={submitting}
                      className="w-full px-4 py-3 border border-outline-variant rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-outline/40" 
                      placeholder="Ingrese una clave inicial" 
                      type="password"
                    />
                    <p className="mt-1.5 text-[10px] text-on-surface-variant leading-normal select-none">
                      El rector deberá cambiar esta contraseña de forma obligatoria en su primer inicio de sesión.
                    </p>
                  </div>
                )}

                {/* IED select option */}
                 <div className="relative">
                   <label className="block text-xs font-semibold text-on-surface mb-2">
                     IED Asignada (Código DANE)
                   </label>
                   
                   {/* Backdrop to close the dropdown when clicking outside */}
                   {isIedDropdownOpen && (
                     <div 
                       onClick={() => setIsIedDropdownOpen(false)}
                       className="fixed inset-0 z-[40] bg-transparent"
                     ></div>
                   )}

                   {/* Custom dropdown trigger button */}
                   <div 
                     onClick={() => !submitting && setIsIedDropdownOpen(!isIedDropdownOpen)}
                     className={`w-full px-4 py-3 border border-outline-variant rounded-xl text-sm bg-surface cursor-pointer flex justify-between items-center select-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 ${
                       isIedDropdownOpen ? 'border-primary ring-1 ring-primary' : 'hover:border-outline'
                     } ${submitting ? 'bg-surface-container text-on-surface-variant cursor-not-allowed' : ''}`}
                   >
                     <span className={formIedId ? 'text-on-surface font-medium truncate' : 'text-outline/70'}>
                       {formIedId 
                         ? iedOptions.find(o => o.id === formIedId)?.nombre || 'Seleccione una IED'
                         : 'Seleccione una IED'}
                     </span>
                     <span className="material-symbols-outlined text-on-surface-variant transition-transform duration-200" style={{ transform: isIedDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                       arrow_drop_down
                     </span>
                   </div>

                   {/* Dropdown Options absolute panel */}
                   {isIedDropdownOpen && (
                     <div className="absolute left-0 right-0 mt-1.5 bg-surface border border-outline-variant rounded-2xl shadow-xl z-[50] flex flex-col max-h-[300px] overflow-hidden animate-scaleUp">
                       {/* Search Box inside dropdown */}
                       <div className="p-3 border-b border-outline-variant/40 bg-surface-container-lowest">
                         <input 
                           type="text"
                           ref={(input) => { if (input) input.focus(); }}
                           value={iedSearch}
                           onChange={(e) => setIedSearch(e.target.value)}
                           placeholder="Buscar por nombre o DANE..."
                           className="w-full px-3 py-2 border border-outline-variant rounded-xl text-xs focus:outline-none focus:border-primary placeholder:text-outline/40 bg-surface"
                         />
                       </div>
                       
                       {/* Options list container */}
                       <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/20 max-h-[200px]">
                         {filteredIedOptions.length === 0 ? (
                           <div className="p-4 text-center text-xs text-on-surface-variant">
                             No se encontraron resultados
                           </div>
                         ) : (
                           filteredIedOptions.map(option => (
                             <div 
                               key={option.id}
                               onClick={() => {
                                 setFormIedId(option.id);
                                 setIsIedDropdownOpen(false);
                               }}
                               className={`px-4 py-3 text-xs text-left cursor-pointer transition-colors hover:bg-surface-container-high flex justify-between items-center ${
                                 formIedId === option.id 
                                   ? 'bg-primary/5 font-bold text-primary' 
                                   : 'text-on-surface'
                               }`}
                             >
                               <div className="flex flex-col pr-3">
                                 <span className="font-semibold">{option.nombre}</span>
                                 <span className="text-[10px] text-on-surface-variant font-mono mt-0.5">DANE: {option.id}</span>
                               </div>
                               {formIedId === option.id && (
                                 <span className="material-symbols-outlined text-primary text-sm font-bold shrink-0">check</span>
                               )}
                             </div>
                           ))
                         )}
                       </div>
                     </div>
                   )}
                   <p className="mt-2 text-[10px] md:text-xs text-on-surface-variant leading-relaxed">
                     El rector tendrá acceso exclusivo a los datos y envío de novedades de la IED seleccionada.
                   </p>
                 </div>

                {/* Active user toggle checkbox switch */}
                <div className="flex items-center gap-3 mt-2 select-none">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      disabled={submitting}
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-outline-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary"></div>
                    <span className="ml-3 text-xs font-semibold text-on-surface">Usuario Rector Activo</span>
                  </label>
                </div>
                
                {/* Hidden submit trigger */}
                <button type="submit" className="hidden" id="submitFormBtn"></button>
              </form>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-6 border-t border-outline-variant/60 flex justify-end gap-3 bg-surface-container-lowest select-none mt-auto">
              <button 
                disabled={submitting}
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 border border-primary text-primary rounded-xl font-semibold text-xs transition-colors hover:bg-surface-container-low disabled:opacity-55"
              >
                Cancelar
              </button>
              <button 
                disabled={submitting}
                onClick={() => document.getElementById('submitFormBtn')?.click()}
                className="px-5 py-2.5 bg-primary hover:bg-[#002f6c] text-on-primary rounded-xl font-semibold text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-[0.98] disabled:opacity-65"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>
                    <span>Guardar Rector</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Edit IED Dias Autorizados Modal */}
      {isIedModalOpen && selectedIed && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4 z-[110] animate-custom-fade-in font-sans">
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-custom-scale-up select-none">
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/40 mb-4">
              <h3 className="text-base font-bold text-primary flex items-center gap-1.5">
                <span className="material-symbols-outlined text-secondary">date_range</span>
                Configurar Días Autorizados
              </h3>
              <button 
                type="button" 
                onClick={() => setIsIedModalOpen(false)}
                className="text-outline hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-surface border border-outline-variant/50 rounded-xl p-3.5">
                <span className="block text-[10px] uppercase font-bold text-outline">Institución</span>
                <span className="text-sm font-bold text-primary">{selectedIed.nombre}</span>
                <span className="block text-[10px] text-on-surface-variant font-mono mt-0.5">DANE: {selectedIed.id}</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface-variant mb-1.5">
                  Días Autorizados (Resolución)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Ej: 9 (Dejar en blanco para limpiar/desactivar)"
                  value={editDiasValue}
                  onChange={(e) => setEditDiasValue(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-medium"
                />
                <p className="text-[10px] text-on-surface-variant leading-relaxed mt-1.5 italic">
                  * Si se deja en blanco, el sistema mostrará "Tope pendiente de configurar" al rector y no calculará el prorrateo de horas.
                </p>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-outline-variant/40 mt-6">
                <button
                  type="button"
                  onClick={() => setIsIedModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold text-xs hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSaveIedDias}
                  className="px-5 py-2 bg-primary hover:bg-[#002f6c] text-on-primary rounded-xl font-semibold text-xs transition-colors active:scale-[0.98] disabled:opacity-65"
                >
                  {submitting ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
