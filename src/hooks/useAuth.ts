import { useAuthContext } from '../contexts/AuthContext';

/**
 * Hook personalizado para acceder fácilmente al estado de autenticación y los perfiles del usuario
 * (nombre, rol de rector/admin_nomina, IED asignada, etc.) en cualquier componente de la aplicación.
 */
export const useAuth = () => {
  return useAuthContext();
};
export type { AuthContextType } from '../contexts/AuthContext';
