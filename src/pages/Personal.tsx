import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAlert } from '../contexts/AlertContext';
import { personalService } from '../services/personalService';
import type { PersonalRecord } from '../services/personalService';
import { rectorService } from '../services/rectorService';
import type { IedOption } from '../services/rectorService';

export const Personal = () => {
  const { showAlert } = useAlert();
  
  const [personalList, setPersonalList] = useState<PersonalRecord[]>([]);
  const [iedOptions, setIedOptions] = useState<IedOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  
  // Tab control state
  const [activeTab, setActiveTab] = useState<'docente' | 'administrativo'>('docente');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PersonalRecord | null>(null);

  // Form input states
  const [formCedula, setFormCedula] = useState('');
  const [formNombres, setFormNombres] = useState('');
  const [formApellidos, setFormApellidos] = useState('');
  const [formCargo, setFormCargo] = useState('');
  const [formGrado, setFormGrado] = useState('');
  const [formIedId, setFormIedId] = useState('');
  const [formActivo, setFormActivo] = useState(true);
  const [iedSearch, setIedSearch] = useState('');
  const [isIedDropdownOpen, setIsIedDropdownOpen] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cargar IEDs una sola vez al montar
  useEffect(() => {
    const loadIeds = async () => {
      try {
        const ieds = await rectorService.getIeds();
        setIedOptions(ieds);
      } catch (err) {
        console.error('Error al cargar IEDs:', err);
      }
    };
    loadIeds();
  }, []);

  // Cargar datos paginados y filtrados en el servidor
  const loadData = async () => {
    setLoading(true);
    try {
      const { data, count } = await personalService.getPersonalPaged(
        activeTab,
        debouncedSearch,
        currentPage,
        itemsPerPage
      );
      setPersonalList(data);
      setTotalCount(count);
    } catch (err: any) {
      console.error('Error al cargar datos:', err);
      showAlert('error', 'Error de Carga', 'No se pudieron obtener los datos del servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, debouncedSearch, currentPage]);

  // Debounce del buscador
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Body scroll lock effect
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen]);

  // Paginación
  const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;
  const paginatedPersonal = personalList; // Ya viene paginado del servidor

  const filteredIedOptions = useMemo(() => {
    const q = iedSearch.toLowerCase().trim();
    if (!q) return iedOptions;
    return iedOptions.filter(opt => 
      opt.id === formIedId || 
      opt.nombre.toLowerCase().includes(q) || 
      opt.id.includes(q)
    );
  }, [iedOptions, iedSearch, formIedId]);

  const selectedIedName = useMemo(() => {
    const found = iedOptions.find(opt => opt.id === formIedId);
    return found ? `${found.nombre} (DANE: ${found.id})` : 'Seleccionar Institución Educativa...';
  }, [iedOptions, formIedId]);

  // Modal Open Handlers
  const handleOpenAddModal = () => {
    setEditingRecord(null);
    setFormCedula('');
    setFormNombres('');
    setFormApellidos('');
    setFormCargo('');
    setFormGrado('');
    setFormIedId('');
    setFormActivo(true);
    setIedSearch('');
    setIsIedDropdownOpen(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (record: PersonalRecord) => {
    setEditingRecord(record);
    setFormCedula(record.cedula);
    setFormNombres(record.nombres);
    setFormApellidos(record.apellidos);
    setFormCargo(record.cargo);
    setFormGrado(record.grado_escalafon || '');
    setFormIedId(record.ied_id || '');
    setFormActivo(record.activo);
    setIedSearch('');
    setIsIedDropdownOpen(false);
    setIsModalOpen(true);
  };

  // Guardar Manual (Crear / Editar)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const cedulaTrimmed = formCedula.trim().toUpperCase();
    if (!cedulaTrimmed || !/^[A-Z0-9]{1,10}$/.test(cedulaTrimmed)) {
      showAlert('warning', 'Validación', 'La cédula debe ser alfanumérica y tener máximo 10 caracteres.');
      return;
    }

    if (!formNombres.trim() || !formApellidos.trim() || !formCargo.trim()) {
      showAlert('warning', 'Validación', 'Por favor complete todos los campos requeridos.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingRecord) {
        // Editar existente
        await personalService.updatePersonal(editingRecord.id, {
          cedula: cedulaTrimmed,
          nombres: formNombres.trim(),
          apellidos: formApellidos.trim(),
          cargo: formCargo.trim(),
          grado_escalafon: activeTab === 'docente' ? formGrado.trim() || null : null,
          ied_id: formIedId || null,
          activo: formActivo
        });
        showAlert('success', 'Registro Actualizado', 'El personal ha sido actualizado correctamente.');
      } else {
        // Crear nuevo
        await personalService.createPersonal({
          cedula: cedulaTrimmed,
          nombres: formNombres.trim(),
          apellidos: formApellidos.trim(),
          cargo: formCargo.trim(),
          tipo: activeTab,
          grado_escalafon: activeTab === 'docente' ? formGrado.trim() || null : null,
          ied_id: formIedId || null,
          activo: formActivo
        });
        showAlert('success', 'Registro Exitoso', 'El personal ha sido registrado correctamente.');
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error(err);
      showAlert('error', 'Error al Guardar', 'No se pudo guardar la información: ' + (err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  // Alternar Estado Activo/Inactivo
  const handleToggleStatus = async (record: PersonalRecord) => {
    const nextStatus = !record.activo;
    showAlert('info', 'Actualizando Estado', `Cambiando estado de ${record.nombres} ${record.apellidos}...`);
    try {
      await personalService.updatePersonal(record.id, { activo: nextStatus });
      showAlert('success', 'Estado Actualizado', `El personal ha sido ${nextStatus ? 'activado' : 'desactivado'} con éxito.`);
      await loadData();
    } catch (err: any) {
      console.error(err);
      showAlert('error', 'Error al Actualizar', 'No se pudo modificar el estado: ' + err.message);
    }
  };

  // Manejar importación CSV
  const handleImportButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      try {
        setLoading(true);
        const res = await personalService.importPersonalCsv(text, activeTab);
        showAlert('success', 'Carga Completada', `Proceso completado. Registros insertados/actualizados con éxito: ${res.successCount}. Fallidos: ${res.errorCount}`);
        await loadData();
      } catch (err: any) {
        console.error(err);
        showAlert('error', 'Error de Importación', err.message || err);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset
  };

  return (
    <div className="space-y-6">
      {/* Cabecera de Botones y Descripción */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 select-none bg-surface-container-low/30 p-5 rounded-2xl border border-outline-variant/30">
        <div>
          <p className="text-xs md:text-sm text-on-surface-variant font-semibold">
            Administra el registro del personal docente global y el personal administrativo de las IEDs.
          </p>
        </div>

        <div className="flex gap-3">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".csv" 
            className="hidden" 
          />
          <button
            onClick={handleImportButtonClick}
            disabled={loading}
            className="px-4 py-2 border-2 border-primary/20 hover:border-primary bg-surface hover:bg-primary/5 rounded-xl text-xs font-bold text-primary transition-all flex items-center gap-2 active:scale-[0.98]"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>upload_file</span>
            Importar CSV
          </button>
          
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-primary hover:bg-primary/95 hover:shadow-md text-on-primary rounded-xl text-xs font-black transition-all flex items-center gap-2 active:scale-[0.98]"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_add</span>
            Agregar Manual
          </button>
        </div>
      </div>

      {/* Control de Pestañas */}
      <div className="flex gap-2 p-1 bg-surface-container-lowest border border-outline-variant/60 rounded-xl w-fit select-none">
        <button
          onClick={() => setActiveTab('docente')}
          className={`px-5 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 ${
            activeTab === 'docente'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-outline hover:text-on-surface hover:bg-surface-container-low'
          }`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>assignment_ind</span>
          Personal Docente
        </button>
        <button
          onClick={() => setActiveTab('administrativo')}
          className={`px-5 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 ${
            activeTab === 'administrativo'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-outline hover:text-on-surface hover:bg-surface-container-low'
          }`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>badge</span>
          Personal Administrativo
        </button>
      </div>

      {/* Tabla y Panel */}
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.015)] animate-fadeIn">
        {/* Filtros de la Tabla */}
        <div className="p-6 border-b border-outline-variant/50 flex flex-col sm:flex-row justify-between items-center gap-4 bg-surface-container-lowest">
          <h3 className="text-base font-bold text-primary select-none">
            {activeTab === 'docente' ? 'Docentes Registrados' : 'Administrativos Registrados'}
          </h3>
          <div className="relative w-full sm:w-72">
            <span className="material-symbols-outlined absolute left-3.5 top-3 text-on-surface-variant text-sm select-none">search</span>
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-outline-variant rounded-xl text-xs md:text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-outline/50" 
              placeholder="Buscar por cédula, nombre, cargo..." 
              type="text"
            />
          </div>
        </div>

        {/* Contenedor de la Tabla */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
              <span className="text-sm font-medium text-on-surface-variant">Cargando personal...</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container-low/60 border-b border-outline-variant/80 select-none">
                <tr>
                  <th className="py-3 px-6 font-semibold text-xs md:text-sm text-on-surface-variant whitespace-nowrap">Cédula / Documento</th>
                  <th className="py-3 px-6 font-semibold text-xs md:text-sm text-on-surface-variant whitespace-nowrap">Nombre Completo</th>
                  <th className="py-3 px-6 font-semibold text-xs md:text-sm text-on-surface-variant whitespace-nowrap">Cargo</th>
                  {activeTab === 'docente' && (
                    <th className="py-3 px-6 font-semibold text-xs md:text-sm text-on-surface-variant whitespace-nowrap text-center">Escalafón</th>
                  )}
                  {activeTab === 'administrativo' && (
                    <th className="py-3 px-6 font-semibold text-xs md:text-sm text-on-surface-variant whitespace-nowrap">IED Asignada</th>
                  )}
                  <th className="py-3 px-6 font-semibold text-xs md:text-sm text-on-surface-variant whitespace-nowrap text-center">Estado</th>
                  <th className="py-3 px-6 font-semibold text-xs md:text-sm text-on-surface-variant whitespace-nowrap text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {paginatedPersonal.length === 0 ? (
                  <tr>
                    <td colSpan={activeTab === 'docente' ? 6 : 6} className="py-8 text-center text-xs md:text-sm text-on-surface-variant/75 font-medium">
                      No se encontraron registros de personal coincidentes.
                    </td>
                  </tr>
                ) : (
                  paginatedPersonal.map(record => (
                    <tr key={record.id} className="hover:bg-surface-container-lowest/50 transition-colors">
                      <td className="py-4 px-6 font-mono text-on-surface-variant font-medium">
                        {record.cedula}
                      </td>
                      <td className="py-4 px-6 font-bold text-primary">
                        {record.nombres} {record.apellidos}
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-600">
                        {record.cargo}
                      </td>
                      {activeTab === 'docente' && (
                        <td className="py-4 px-6 text-center font-bold text-secondary">
                          {record.grado_escalafon || (
                            <span className="text-outline text-[11px] font-normal">Sin grado</span>
                          )}
                        </td>
                      )}
                      {activeTab === 'administrativo' && (
                        <td className="py-4 px-6 font-semibold text-primary/80">
                          {record.ied?.nombre || (
                            <span className="text-outline text-[11px] font-normal">No asignada</span>
                          )}
                        </td>
                      )}
                      <td className="py-4 px-6 select-none text-center">
                        <span className={`inline-flex items-center px-2.5 py-1.5 rounded-full text-[10px] font-semibold border ${
                          record.activo 
                            ? 'bg-green-50 text-green-700 border-green-200' 
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${record.activo ? 'bg-green-600' : 'bg-red-600'}`}></span>
                          {record.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right select-none">
                        <div className="inline-flex gap-2">
                          <button 
                            onClick={() => handleOpenEditModal(record)}
                            className="p-1.5 hover:bg-surface-container rounded-lg text-secondary transition-colors"
                            title="Editar registro"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                          </button>
                          <button 
                            onClick={() => handleToggleStatus(record)}
                            className={`p-1.5 hover:bg-surface-container rounded-lg transition-colors ${
                              record.activo ? 'text-error hover:text-error/85' : 'text-green-700 hover:text-green-700/85'
                            }`}
                            title={record.activo ? 'Desactivar registro' : 'Activar registro'}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                              {record.activo ? 'block' : 'check_circle'}
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

        {/* Paginación */}
        {!loading && totalCount > 0 && (
          <div className="p-5 border-t border-outline-variant/60 flex justify-between items-center select-none bg-surface-container-lowest">
            <span className="text-[11px] md:text-xs text-on-surface-variant font-medium">
              Mostrando {paginatedPersonal.length} de {totalCount} registros
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

      {/* Modal de Agregar / Editar Personal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-[3px] flex items-center justify-center p-4 z-50 animate-fadeIn duration-200">
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-3xl w-full max-w-lg shadow-[0_20px_50px_rgba(0,0,0,0.25)] overflow-hidden animate-zoomIn">
            
            {/* Cabecera del Modal */}
            <div className="px-6 py-5 border-b border-outline-variant/50 flex justify-between items-center select-none bg-surface-container-low/20">
              <div className="flex items-center gap-2 text-primary">
                <span className="material-symbols-outlined text-lg">person</span>
                <h3 className="font-black text-sm md:text-base">
                  {editingRecord ? 'Editar Registro de Personal' : `Registrar Nuevo ${activeTab === 'docente' ? 'Docente' : 'Administrativo'}`}
                </h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-surface-container rounded-full text-outline hover:text-on-surface transition-colors"
                disabled={submitting}
              >
                <span className="material-symbols-outlined text-sm font-bold">close</span>
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  {/* Cédula */}
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-on-surface mb-1.5">Cédula / Documento</label>
                    <input 
                      type="text" 
                      required
                      value={formCedula}
                      onChange={(e) => setFormCedula(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10))}
                      disabled={submitting}
                      placeholder="Máx 10 alfanuméricos"
                      className="w-full px-3 py-2 border border-outline-variant rounded-xl text-xs focus:outline-none focus:border-primary placeholder:text-outline/40"
                    />
                  </div>

                  {/* Cargo */}
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-on-surface mb-1.5">Cargo</label>
                    <input 
                      type="text" 
                      required
                      value={formCargo}
                      onChange={(e) => setFormCargo(e.target.value)}
                      disabled={submitting}
                      placeholder="Ej. Docente de aula"
                      className="w-full px-3 py-2 border border-outline-variant rounded-xl text-xs focus:outline-none focus:border-primary placeholder:text-outline/40"
                    />
                  </div>

                  {/* Nombres */}
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-on-surface mb-1.5">Nombres</label>
                    <input 
                      type="text" 
                      required
                      value={formNombres}
                      onChange={(e) => setFormNombres(e.target.value)}
                      disabled={submitting}
                      placeholder="Nombres completos"
                      className="w-full px-3 py-2 border border-outline-variant rounded-xl text-xs focus:outline-none focus:border-primary placeholder:text-outline/40"
                    />
                  </div>

                  {/* Apellidos */}
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-on-surface mb-1.5">Apellidos</label>
                    <input 
                      type="text" 
                      required
                      value={formApellidos}
                      onChange={(e) => setFormApellidos(e.target.value)}
                      disabled={submitting}
                      placeholder="Apellidos completos"
                      className="w-full px-3 py-2 border border-outline-variant rounded-xl text-xs focus:outline-none focus:border-primary placeholder:text-outline/40"
                    />
                  </div>

                  {/* Grado Escalafón (Solo Docentes) */}
                  {activeTab === 'docente' && (
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs font-semibold text-on-surface mb-1.5">Grado Escalafón</label>
                      <input 
                        type="text" 
                        value={formGrado}
                        onChange={(e) => setFormGrado(e.target.value)}
                        disabled={submitting}
                        placeholder="Ej. 14 o 2A (Opcional)"
                        className="w-full px-3 py-2 border border-outline-variant rounded-xl text-xs focus:outline-none focus:border-primary placeholder:text-outline/40"
                      />
                    </div>
                  )}

                  {/* IED dropdown selector (Principalmente para Administrativos) */}
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-on-surface mb-1.5">
                      Institución Educativa (IED)
                      {activeTab === 'docente' && <span className="text-[10px] text-outline/70 font-normal"> (Opcional para docentes)</span>}
                    </label>
                    
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => !submitting && setIsIedDropdownOpen(!isIedDropdownOpen)}
                        className="w-full px-3 py-2 border border-outline-variant rounded-xl text-xs focus:outline-none focus:border-primary flex justify-between items-center text-left bg-surface select-none"
                      >
                        <span className={formIedId ? 'text-on-surface font-semibold' : 'text-outline/40'}>
                          {selectedIedName}
                        </span>
                        <span className="material-symbols-outlined text-sm text-outline">arrow_drop_down</span>
                      </button>

                      {isIedDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1.5 bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-xl z-50 p-3 space-y-2 animate-fadeIn max-h-52 overflow-y-auto">
                          <input
                            type="text"
                            value={iedSearch}
                            onChange={(e) => setIedSearch(e.target.value)}
                            placeholder="Buscar IED por nombre o código..."
                            className="w-full px-3 py-1.5 border border-outline-variant rounded-xl text-xs focus:outline-none focus:border-primary"
                          />
                          <div className="divide-y divide-outline-variant/30">
                            <button
                              type="button"
                              onClick={() => {
                                setFormIedId('');
                                setIsIedDropdownOpen(false);
                              }}
                              className="w-full text-left py-2 px-2 text-xs hover:bg-primary/5 hover:text-primary transition-all font-semibold rounded-lg text-outline"
                            >
                              Ninguna (Dejar Global / Null)
                            </button>
                            {filteredIedOptions.map(opt => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  setFormIedId(opt.id);
                                  setIsIedDropdownOpen(false);
                                }}
                                className="w-full text-left py-2 px-2 text-xs hover:bg-primary/5 hover:text-primary transition-all font-semibold rounded-lg"
                              >
                                {opt.nombre} <span className="text-[10px] text-outline font-normal">({opt.id})</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Estado Activo */}
                  <div className="col-span-2 flex items-center gap-2 select-none pt-2">
                    <input 
                      type="checkbox"
                      id="formActivo"
                      checked={formActivo}
                      onChange={(e) => setFormActivo(e.target.checked)}
                      disabled={submitting}
                      className="rounded border-outline-variant text-primary focus:ring-primary/20 h-4 w-4"
                    />
                    <label htmlFor="formActivo" className="text-xs font-semibold text-on-surface cursor-pointer">
                      Habilitado / Activo
                    </label>
                  </div>
                </div>
              </div>

              {/* Botones del Formulario */}
              <div className="px-6 py-4 border-t border-outline-variant/50 bg-surface-container-low/20 flex justify-end gap-3 select-none">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 border border-outline-variant hover:bg-surface-container rounded-xl text-xs font-bold text-outline hover:text-on-surface transition-colors active:scale-[0.98]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary hover:bg-primary/95 text-on-primary rounded-xl text-xs font-black transition-all flex items-center gap-1.5 active:scale-[0.98]"
                >
                  {submitting && <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-on-primary mr-1"></div>}
                  {editingRecord ? 'Guardar Cambios' : 'Registrar'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
};
