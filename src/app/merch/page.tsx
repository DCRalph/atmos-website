import { ImageCycleBackground } from "~/app/_components/image-cycle-background";
import Link from "next/link";
import Image from "next/image";

type MerchItem = {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
};

const merchItems: MerchItem[] = [
  {
    id: 1,
    name: "Atmos classic oversized tee",
    description: "Classic oversized Atmos tee. (White)",
    price: 69.69,
    image: "/shop/1.jpg",
  },
  {
    id: 2,
    name: "Atmos classic oversized tee",
    description: "Classic oversized Atmos tee. (Black)",
    price: 69.69,
    image: "/shop/1.jpg",
  },
];

export default function MerchPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <ImageCycleBackground intervalMs={5000} auto={true} />

      <section className="relative z-10 min-h-screen px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">

          <h1 className="mb-12 sm:mb-16 text-center text-4xl sm:text-5xl font-bold tracking-wider md:text-7xl">
            MERCH
          </h1>

          <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Placeholder merch items - replace with actual data */}
            {merchItems.map((item) => (
              <div
                key={item.id}
                className="group relative overflow-hidden rounded-lg border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/10"
              >
                <div className="mb-4 select-none aspect-square hover:scale-105 hover:rotate-3 transition-all duration-300 overflow-hidden relative w-full bg-white/10 rounded-lg flex items-center justify-center">
                  <Image
                    src={item.image}
                    alt="Product Image"
                    fill
                    className="object-cover"
                  />
                </div>
                <h3 className="mb-2 text-lg sm:text-xl font-semibold">{item.name}</h3>
                <p className="mb-4 text-xs sm:text-sm text-white/60">
                  {item.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-base sm:text-lg font-bold">${item.price}</span>
                  <button className="rounded-md bg-white px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-black transition-all hover:bg-white/90">
                    Add to Cart
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

