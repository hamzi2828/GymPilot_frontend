import Image from "next/image";

export const PaymentMethods = () => (
  <div className="gym-cart-payment-icons">
    <button 
      className="gym-cart-payment-icon-link hover:scale-110 transition-transform duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded p-1" 
      data-payment="mastercard"
    >
      <Image src="/images/MasterCard.svg" alt="Pay with Mastercard" width={40} height={25} className="gym-cart-payment-icon" />
    </button>
    <button 
      className="gym-cart-payment-icon-link hover:scale-110 transition-transform duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded p-1" 
      data-payment="visa"
    >
      <Image src="/images/Visa.svg" alt="Pay with Visa" width={40} height={25} className="gym-cart-payment-icon" />
    </button>
    <button 
      className="gym-cart-payment-icon-link hover:scale-110 transition-transform duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded p-1" 
      data-payment="paypal"
    >
      <Image src="/images/PayPal.svg" alt="Pay with PayPal" width={40} height={25} className="gym-cart-payment-icon" />
    </button>
    <button 
      className="gym-cart-payment-icon-link hover:scale-110 transition-transform duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded p-1" 
      data-payment="unionpay"
    >
      <Image src="/images/unionpay.svg" alt="Pay with UnionPay" width={40} height={25} className="gym-cart-payment-icon" />
    </button>
  </div>
);