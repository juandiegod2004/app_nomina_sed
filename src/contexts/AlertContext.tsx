import React, { createContext, useContext, useState } from 'react';

type AlertType = 'success' | 'error' | 'warning' | 'info';

interface AlertContextType {
  showAlert: (
    type: AlertType,
    title: string,
    message: string,
    onConfirm?: () => void,
    showCancel?: boolean,
    onCancel?: () => void
  ) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alertState, setAlertState] = useState<{
    type: AlertType;
    title: string;
    message: string;
    onConfirm?: () => void;
    showCancel?: boolean;
    onCancel?: () => void;
  } | null>(null);

  const showAlert = (
    type: AlertType,
    title: string,
    message: string,
    onConfirm?: () => void,
    showCancel?: boolean,
    onCancel?: () => void
  ) => {
    setAlertState({ type, title, message, onConfirm, showCancel, onCancel });
  };

  const handleConfirm = () => {
    const callback = alertState?.onConfirm;
    setAlertState(null);
    if (callback) {
      setTimeout(() => callback(), 50);
    }
  };

  const handleCancel = () => {
    const callback = alertState?.onCancel;
    setAlertState(null);
    if (callback) {
      setTimeout(() => callback(), 50);
    }
  };

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      
      {/* Styles for dynamic micro-animations */}
      <style>{`
        @keyframes customFadeIn {
          from { opacity: 0; backdrop-filter: blur(0px); }
          to { opacity: 1; backdrop-filter: blur(4px); }
        }
        @keyframes customScaleUp {
          from { transform: scale(0.92); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-custom-fade-in {
          animation: customFadeIn 0.25s ease-out forwards;
        }
        .animate-custom-scale-up {
          animation: customScaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>

      {alertState && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[9999] animate-custom-fade-in font-sans">
          <div className="bg-[#f8f9fa] border border-[#e3e3e3] rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-custom-scale-up select-none relative overflow-hidden">
            
            {/* Top color border indicator */}
            <div className={`absolute top-0 inset-x-0 h-1.5 ${
              alertState.type === 'success' ? 'bg-emerald-500' :
              alertState.type === 'error' ? 'bg-rose-500' :
              alertState.type === 'warning' ? 'bg-amber-500' :
              'bg-blue-500'
            }`} />

            <div className="flex flex-col items-center text-center mt-2">
              {/* Dynamic Theme Icon */}
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-sm transition-transform duration-200 ${
                alertState.type === 'success' ? 'bg-emerald-100 text-emerald-800' :
                alertState.type === 'error' ? 'bg-rose-100 text-rose-800' :
                alertState.type === 'warning' ? 'bg-amber-100 text-amber-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                <span className="material-symbols-outlined" style={{ fontSize: '30px' }}>
                  {alertState.type === 'success' ? 'check_circle' :
                   alertState.type === 'error' ? 'error' :
                   alertState.type === 'warning' ? 'warning' :
                   'info'}
                </span>
              </div>
              
              {/* Title */}
              <h3 className="font-bold text-base md:text-lg text-[#002f6c] mb-2 leading-tight">
                {alertState.title}
              </h3>
              
              {/* Message */}
              <p className="text-xs md:text-sm text-slate-600 leading-relaxed mb-6 font-medium">
                {alertState.message}
              </p>
              
              {/* Action Buttons Layout */}
              <div className="flex gap-3 w-full mt-2">
                {alertState.showCancel && (
                  <button
                    onClick={handleCancel}
                    className="flex-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs py-3 rounded-xl transition-all duration-200 active:scale-[0.98] shadow-sm tracking-wide uppercase"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  onClick={handleConfirm}
                  className="flex-1 bg-[#002f6c] hover:bg-[#00204a] text-white font-semibold text-xs py-3 rounded-xl transition-all duration-200 active:scale-[0.98] shadow-sm tracking-wide uppercase"
                >
                  Aceptar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert debe utilizarse dentro de un AlertProvider');
  }
  return context;
};
