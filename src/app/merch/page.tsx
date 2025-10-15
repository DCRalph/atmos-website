import { ImageCycleBackground } from "~/app/_components/image-cycle-background";
import Link from "next/link";
import { api } from "~/trpc/server";

export default async function MerchPage() {
  const items = await api.merch.list({ activeOnly: true });
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* <ImageCycleBackground intervalMs={5000} auto={true} /> */}

      <section className="relative z-10 min-h-screen px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12">
            <Link href="/" className="text-white/60 hover:text-white transition-colors">
              ← Back
            </Link>
          </div>

          <h1 className="mb-12 text-center text-5xl font-bold tracking-wider md:text-7xl">
            MERCH
          </h1>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="group relative overflow-hidden rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/10"
              >
                <div className="mb-4 aspect-square w-full bg-white/10 rounded-lg flex items-center justify-center">
                  <span className="text-white/40 text-sm">{item.imageUrl ? "Image" : "Product Image"}</span>
                </div>
                <h3 className="mb-2 text-xl font-semibold">{item.title}</h3>
                <p className="mb-4 text-sm text-white/60">{item.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">${(item.priceCents / 100).toFixed(2)}</span>
                  <button className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-black transition-all hover:bg-white/90">
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

