import Image from "next/image";
import Link from "next/link";
import { CartItem as CartItemType } from "@/types/cart";

interface CartItemProps {
  item: CartItemType;
  onUpdateQuantity: (id: number, change: number) => void;
  onRemove: (id: number) => void;
}

export const CartItem = ({ item, onUpdateQuantity, onRemove }: CartItemProps) => (
  <article className="gym-cart-card">
    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
      <div className="flex gap-3 sm:gap-4 flex-1">
        <div className="flex-shrink-0">
          <Link href="/product-detail" className="block">
            <Image 
              src={item.image} 
              alt={item.name}
              width={96}
              height={96}
              className="gym-cart-product-image flex-shrink-0"
            />
          </Link>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-col gap-2 mb-2">
            <Link href="/product-detail" className="gym-cart-product-title text-black hover:underline">
              {item.name}
            </Link>
            <p className="gym-cart-product-size text-black">
              SIZE: {item.size}
            </p>
          </div>
          <p className="gym-cart-product-price">
            Rs <span className="item-price">{item.price.toLocaleString()}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="gym-cart-quantity-controls">
          <button
            className="gym-cart-quantity-btn decrease-btn"
            onClick={() => onUpdateQuantity(item.id, -1)}
            aria-label="Decrease quantity"
            type="button"
          >
            <i className="fas fa-minus"></i>
          </button>
          <span className="gym-cart-quantity-number item-quantity">{item.quantity}</span>
          <button
            className="gym-cart-quantity-btn increase-btn"
            onClick={() => onUpdateQuantity(item.id, 1)}
            aria-label="Increase quantity"
            type="button"
          >
            <i className="fas fa-plus"></i>
          </button>
        </div>
        <button
          className="gym-cart-remove-btn"
          onClick={() => onRemove(item.id)}
          aria-label="Remove item"
          type="button"
        >
          <i className="fas fa-trash-alt"></i>
        </button>
      </div>
    </div>
  </article>
);