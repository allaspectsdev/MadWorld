export interface ShopEntry {
  itemId: string;
  buyPrice: number;
  stock: number; // -1 = unlimited
}

export const SHOPS: Record<string, ShopEntry[]> = {
  shopkeeper: [
    { itemId: "bread", buyPrice: 10, stock: -1 },
    { itemId: "cooked_shrimp", buyPrice: 15, stock: -1 },
    { itemId: "cooked_trout", buyPrice: 30, stock: -1 },
    { itemId: "fishing_rod", buyPrice: 40, stock: -1 },
    { itemId: "bronze_pickaxe", buyPrice: 50, stock: -1 },
    { itemId: "bronze_axe", buyPrice: 50, stock: -1 },
    { itemId: "leather_cap", buyPrice: 40, stock: -1 },
    { itemId: "leather_tunic", buyPrice: 80, stock: -1 },
    { itemId: "leather_pants", buyPrice: 60, stock: -1 },
    { itemId: "leather_boots", buyPrice: 30, stock: -1 },
    { itemId: "wooden_shield", buyPrice: 50, stock: -1 },
    { itemId: "wooden_sword", buyPrice: 20, stock: -1 },
    { itemId: "wooden_bow", buyPrice: 30, stock: -1 },
  ],
  blacksmith: [
    { itemId: "bronze_sword", buyPrice: 100, stock: -1 },
    { itemId: "bronze_helm", buyPrice: 120, stock: -1 },
    { itemId: "bronze_platebody", buyPrice: 240, stock: -1 },
    { itemId: "iron_sword", buyPrice: 400, stock: 3 },
  ],
};
