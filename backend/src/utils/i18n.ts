import uz from '../locales/uz.js';

export function L(_?: unknown) {
  return uz;
}

export function price(amount: number, _?: unknown): string {
  return `${amount.toLocaleString('ru-RU')} ${uz.currency}`;
}
