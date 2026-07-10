import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import type { UserProfile } from '../services/authService';
import { supabase } from '../services/supabase';
import { useAlert } from './AlertContext';

export interface AuthContextType {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isRector: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showAlert } = useAlert();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = profile?.rol === 'admin_nomina';
  const isRector = profile?.rol === 'rector';

  const refreshProfile = async () => {
    try {
      const currentProfile = await authService.getCurrentProfile();
      setProfile(currentProfile);
    } catch (err: any) {
      console.error('Error al actualizar el perfil:', err.message);
      setProfile(null);
    }
  };

  useEffect(() => {
    // 1. Obtener sesión inicial
    const initSession = async () => {
      try {
        const session = await authService.getSession();
        if (session?.user) {
          const userProfile = await authService.getCurrentProfile(session.user.id);
          if (userProfile && userProfile.activo) {
            setProfile(userProfile);
          } else {
            // Perfil inactivo o inexistente, cerrar sesión
            await authService.logout();
            setProfile(null);
            if (userProfile && !userProfile.activo) {
              showAlert('error', 'Usuario Desactivado', 'El usuario ha sido desactivado. Por favor, comuníquese con el área de Servicios Informáticos o con el administrador.');
            }
          }
        }
      } catch (err: any) {
        console.error('Error inicializando sesión:', err.message);
      } finally {
        setLoading(false);
      }
    };

    initSession();

    // 2. Escuchar cambios en la autenticación (login, logout, token_refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Ignorar USER_UPDATED para evitar condiciones de carrera cuando el usuario actualiza su propia clave
      if (event === 'USER_UPDATED') {
        return;
      }

      if (session?.user) {
        const userProfile = await authService.getCurrentProfile(session.user.id);
        if (userProfile && userProfile.activo) {
          setProfile(prev => {
            if (prev && 
                prev.id === userProfile.id && 
                prev.activo === userProfile.activo && 
                prev.rol === userProfile.rol && 
                prev.ied_id === userProfile.ied_id && 
                prev.nombre === userProfile.nombre && 
                prev.correo_institucional === userProfile.correo_institucional) {
              return prev; // Retorna el mismo objeto de estado para evitar re-render
            }
            return userProfile;
          });
        } else {
          setProfile(null);
          if (userProfile && !userProfile.activo) {
            await authService.logout();
            showAlert('error', 'Usuario Desactivado', 'El usuario ha sido desactivado. Por favor, comuníquese con el área de Servicios Informáticos o con el administrador.');
          }
        }
      } else {
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (username: string, password: string): Promise<UserProfile> => {
    setError(null);
    setLoading(true);
    try {
      const { profile: userProfile } = await authService.login(username, password);
      setProfile(userProfile);
      return userProfile;
    } catch (err: any) {
      setError(err.message || 'Error desconocido al iniciar sesión.');
      setProfile(null);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authService.logout();
      setProfile(null);
    } catch (err: any) {
      console.error('Error al cerrar sesión:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    profile,
    loading,
    error,
    login,
    logout,
    isAdmin,
    isRector,
    refreshProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};
