export interface CartItem {
  id: number;
  name: string;
  size: string;
  price: number;
  quantity: number;
  image: string;
}

export interface CartSummaryProps {
  cartTotal: number;
  cartSavings: number;
  finalAmount: number;
  remainingForFreeShipping: number;
  shippingProgressPercentage: number;
}
