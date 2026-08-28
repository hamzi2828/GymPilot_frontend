"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CartItem } from "./components/CartItem";
import { CartSummary } from "./components/CartSummary";
import { CartItem as CartItemType } from "@/types/cart";
import '@fortawesome/fontawesome-free/css/all.css';

const CartPage = () => {
  const [cartItems, setCartItems] = useState<CartItemType[]>([
    {
      id: 1,
      name: "WORDMARK CREW SOCKS 3 PACK -PEARL WHITE",
      size: "S",
      price: 21600,
      quantity: 1,
      image: "/images/gym-2.svg"
    }
  ]);

  // Calculate totals
  const cartTotal = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  const cartSavings = 0; // Could be calculated based on discounts
  const finalAmount = cartTotal - cartSavings;
  const freeShippingThreshold = 42481; // 21600 + 20881
  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - cartTotal);
  const shippingProgressPercentage = Math.min(100, (cartTotal / freeShippingThreshold) * 100);

  // Handle quantity changes
  const updateQuantity = (id: number, change: number) => {
    setCartItems(prevItems => 
      prevItems.map(item => 
        item.id === id ? { ...item, quantity: Math.max(1, item.quantity + change) } : item
      )
    );
  };

  // Handle item removal
  const removeItem = (id: number) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== id));
  };

  return (
    <main className="pt-24">
      <section className="gym-cart-section bg-white">
        <div className="mx-auto px-4 sm:px-6 lg:px-20 py-12 sm:py-16 lg:py-20">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 items-start">
            {/* Cart Items Section */}
            <div className="flex-1 w-full">
              <div className="flex flex-col gap-8">
                <header className="flex items-center justify-between">
                  <h2 className="gym-cart-header-title text-black">
                    Cart ({cartItems.length} items)
                  </h2>
                </header>

                <div className="flex flex-col gap-4">
                  {cartItems.map(item => (
                    <CartItem 
                      key={item.id} 
                      item={item} 
                      onUpdateQuantity={updateQuantity}
                      onRemove={removeItem}
                    />
                  ))}

                  {cartItems.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-gray-500 mb-4">Your cart is empty</p>
                      <Link href="/" className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-black hover:bg-gray-800">
                        Continue Shopping
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Cart Summary Section */}
            {cartItems.length > 0 && (
              <aside className="w-full lg:w-[32rem] flex-shrink-0">
                <CartSummary 
                  cartTotal={cartTotal}
                  cartSavings={cartSavings}
                  finalAmount={finalAmount}
                  remainingForFreeShipping={remainingForFreeShipping}
                  shippingProgressPercentage={shippingProgressPercentage}
                />
              </aside>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};

export default CartPage;