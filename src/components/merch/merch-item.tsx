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
    <div className="group relative overflow-hidden rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/10 sm:p-6">
      <div className="relative mb-4 flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-white/10 transition-all duration-300 select-none hover:scale-105 hover:rotate-3">
        <Image src={image} alt="Product Image" fill className="object-cover" />
      </div>
      <h3 className="mb-2 text-lg font-semibold sm:text-xl">{name}</h3>
      <p className="mb-4 text-xs text-white/60 sm:text-sm">{description}</p>
      <div className="flex items-center gap-4">
        <button className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-black transition-all hover:bg-white/90 sm:px-4 sm:py-2 sm:text-sm">
          Add to Cart
        </button>
        <span className="text-base font-bold sm:text-lg">${price}</span>
      </div>
    </div>
  );
}
