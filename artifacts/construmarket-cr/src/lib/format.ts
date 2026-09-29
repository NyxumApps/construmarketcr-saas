export const PROVINCES = [
  'San José',
  'Alajuela',
  'Cartago',
  'Heredia',
  'Guanacaste',
  'Puntarenas',
  'Limón',
] as const;

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const crc = new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 });
const quantity = new Intl.NumberFormat('es-CR', { maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat('es-CR', { dateStyle: 'long' });

export const formatUsd = (value: number) => usd.format(value);
export const formatCrc = (value: number) => crc.format(value);
export const formatQuantity = (value: number) => quantity.format(value);
export const formatDate = (value: string | Date) => date.format(new Date(value));
