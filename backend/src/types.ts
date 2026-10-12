export type Lang = 'uz' | 'ru' | 'en';

export type OrderStatus =
  | 'new'
  | 'received'
  | 'preparing'
  | 'on_way'
  | 'delivered'
  | 'ready_pickup'
  | 'picked_up'
  | 'cancelled';

export interface LocaleText {
  uz: string;
  ru: string;
  en: string;
}

export interface Product {
  id: string;
  category: string;
  emoji: string;
  image?: string | undefined;
  price: number;
  popular?: boolean;
  available: boolean;
  name: LocaleText;
  description: LocaleText;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Order {
  id: string;
  userId: number;
  userName: string;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  discount?: number;
  promotions?: { id: string; title: string; badge: string; amount: number }[];
  total: number;
  status: OrderStatus;
  deliveryType: 'delivery' | 'pickup';
  address?: string;
  location?: { lat: number; lng: number; name: string; mapUrl: string; source: string };
  phone?: string;
  paymentMethod?: string;
  createdAt: Date;
  note?: string;
  /** Payment receipt as sent by the customer (not verified automatically). */
  /** Reason given by the admin when the order was cancelled. */
  cancelReason?: string;
  receipt?: { fileId: string; kind: 'image' | 'pdf'; mime: string; fileName?: string };
}

export interface Promotion {
  type?: "percent" | "fixed" | "bogo" | "second" | "combo" | "happy" | "gift" | "delivery" | "birthday";
  items?: { productId: string; qty: number }[];
  setPrice?: number;
  value?: number;
  buyQty?: number;
  getQty?: number;
  minOrder?: number;
  giftProductId?: string;
  /** Temporary products that exist only inside this promotion (not in the menu). */
  extraProducts?: Product[];
  hoursFrom?: string;
  hoursTo?: string;
  id: string;
  emoji: string;
  image?: string | undefined;
  badge: string;
  active: boolean;
  title: LocaleText;
  description: LocaleText;
  /** YYYY-MM-DD, optional start date */
  startsAt?: string;
  /** YYYY-MM-DD, optional last day (inclusive) */
  endsAt?: string;
}

export type CheckoutStep =
  | 'delivery_type'
  | 'address'
  | 'phone'
  | 'payment'
  | 'note'
  | 'receipt'
  | 'done';

export interface Session {
  userId: number;
  lang: Lang;
  firstName: string;
  phone?: string;
  cart: CartItem[];
  favorites: Set<string>;
  orders: Order[];
  // checkout
  checkoutStep?: CheckoutStep;
  pendingOrder?: Partial<Order>;
  // product nav
  selectedCategory?: string;
  selectedProductId?: string;
  productQty: number;
}
