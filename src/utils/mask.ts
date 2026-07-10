/**
 * Conserva las primeras 3 letras de cada palabra de un nombre completo,
 * capitalizando la primera letra y poniendo las siguientes dos en minúscula.
 * Las letras restantes se reemplazan con asteriscos (*) de igual longitud.
 * Palabras de 3 letras o menos se mantienen en su formato original sin enmascarar.
 * 
 * Ejemplo: "DAVID ENRIQUE MENDEZ RANGEL" -> "Dav** Enr**** Men*** Ran***"
 */
export const enmascararNombre = (nombreCompleto: string): string => {
  if (!nombreCompleto) return '';
  return nombreCompleto
    .split(' ')
    .map(word => {
      // Ignorar espacios adicionales
      if (!word) return '';
      
      if (word.length <= 3) {
        return word;
      }
      
      const visible = word.slice(0, 3);
      const formattedVisible = visible.charAt(0).toUpperCase() + visible.slice(1).toLowerCase();
      const masked = '*'.repeat(word.length - 3);
      return formattedVisible + masked;
    })
    .join(' ');
};
