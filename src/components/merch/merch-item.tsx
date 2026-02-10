"use client";

import Image from "next/image";
import posthog from "posthog-js";

interface MerchItemProps {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
}

export function MerchItem({
  id,
  name,
  description,
  price,
  image,
}: MerchItemProps) {
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-none border-2 border-white/10 bg-black/80 backdrop-blur-sm transition-all hover:border-accent-muted/50 hover:bg-black/90 hover:shadow-[0_0_15px_var(--accent-muted)]">
      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden border-b-2 border-white/10 bg-black/70">
        <Image
          src={image}
          alt={name}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col justify-between gap-4 p-4 sm:p-5">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.3em] text-white/50 uppercase">
            Atmos Merch
          </p>
          <h3 className="mt-2 text-lg font-black tracking-tight text-white uppercase sm:text-xl">
            {name}
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-white/60 sm:text-sm">
            {description}
          </p>
        </div>
        <div className="flex items-center justify-between border-t-2 border-white/10 pt-4">
          <span className="text-base font-bold tracking-wide text-white sm:text-lg">
            ${price}
          </span>
          <button
            type="button"
            className="border-white/20 text-white/90 hover:border-white/50 hover:text-white rounded-none border-2 px-3 py-1.5 text-xs font-semibold tracking-widest uppercase transition-all sm:px-4 sm:py-2"
            onClick={() =>
              posthog.capture("merch_add_to_cart_clicked", {
                merch_item_id: id,
                merch_item_name: name,
                price,
              })
            }
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
