// Comparte el usuario y sus permisos con toda la aplicación.
import { createContext, useContext } from 'react';

export const SesionContext = createContext({ usuario: null, puede: () => false });
export const useSesion = () => useContext(SesionContext);