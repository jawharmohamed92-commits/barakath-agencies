import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | Date) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString.toString();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function getUnitAbbreviation(unit: string) {
  if (!unit || unit === 'None') return '';
  const map: Record<string, string> = {
    'Numbers': 'Nos',
    'Pieces': 'Pcs',
    'Bags': 'Bgs',
    'Cartons': 'Ctn',
    'Dozens': 'Dzn',
    'Meters': 'Mtr',
    'Box': 'Box',
    'Roll': 'Roll'
  };
  return map[unit] || unit;
}
