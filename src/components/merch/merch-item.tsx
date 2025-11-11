import Image from "next/image";

interface MerchItemProps {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
}

export function MerchItem({ name, description, price, image }: MerchItemProps) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/10">
      <div className="mb-4 select-none aspect-square hover:scale-105 hover:rotate-3 transition-all duration-300 overflow-hidden relative w-full bg-white/10 rounded-lg flex items-center justify-center">
        <Image
          src={image}
          alt="Product Image"
          fill
          className="object-cover"
        />
      </div>
      <h3 className="mb-2 text-lg sm:text-xl font-semibold">{name}</h3>
      <p className="mb-4 text-xs sm:text-sm text-white/60">
        {description}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-base sm:text-lg font-bold">${price}</span>
        <button className="rounded-md bg-white px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-black transition-all hover:bg-white/90">
          Add to Cart
        </button>
      </div>
    </div>
  );
}

