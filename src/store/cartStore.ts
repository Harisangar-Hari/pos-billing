import { create } from "zustand";

interface CartItem {
  id: string;
  name: string;
  barcode: string;
  price: number;
  quantity: number;
}

interface CartState {
  items: CartItem[];

  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  increaseQty: (id: string) => void;
  decreaseQty: (id: string) => void;
  clearCart: () => void;
  getTotal: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (item) => {
    const existing = get().items.find((i) => i.id === item.id);

    if (existing) {
      set({
        items: get().items.map((i) =>
          i.id === item.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        ),
      });
    } else {
      set({ items: [...get().items, { ...item, quantity: 1 }] });
    }
  },

  removeItem: (id) =>
    set({ items: get().items.filter((i) => i.id !== id) }),

  increaseQty: (id) =>
    set({
      items: get().items.map((i) =>
        i.id === id ? { ...i, quantity: i.quantity + 1 } : i
      ),
    }),

  decreaseQty: (id) =>
    set({
      items: get().items
        .map((i) =>
          i.id === id
            ? { ...i, quantity: i.quantity - 1 }
            : i
        )
        .filter((i) => i.quantity > 0),
    }),

  clearCart: () => set({ items: [] }),

  getTotal: () =>
    get().items.reduce(
      (sum, i) => sum + i.price * i.quantity,
      0
    ),
}));