import Link from "next/link";
import Image from "next/image";
import { FaInstagram } from "react-icons/fa6";

interface CrewMemberProps {
  id: string;
  name: string;
  role: string;
  image: string;
  instagram?: string | null;
  soundcloud?: string | null;
}

export function CrewMember({
  name,
  role,
  image,
  instagram,
  soundcloud,
}: CrewMemberProps) {
  return (
    <div className="group border-zinc/20 hover:border-zinc/50 relative overflow-hidden rounded-lg border bg-black/20 p-4 backdrop-blur-sm transition-all hover:bg-black/30 sm:p-6 md:p-8">
      <div className="relative mx-auto mb-4 flex aspect-square h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-white/10 sm:mb-6 sm:h-28 sm:w-28 md:h-32 md:w-32">
        <Image src={image} alt={name} fill className="object-cover" />
      </div>

      <div className="text-center">
        <h3 className="mb-2 text-xl font-bold sm:text-2xl">{name}</h3>
        <p className="mb-4 text-xs font-semibold tracking-wider text-white/60 uppercase sm:mb-6 sm:text-sm">
          {role}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {instagram && (
            <Link
              href={instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-white/60 transition-colors hover:text-white hover:underline sm:gap-2"
            >
              <>
                <FaInstagram className="h-4 w-4" />
                <span className="hidden sm:inline">Instagram</span>
              </>
            </Link>
          )}
          {soundcloud && (
            <Link
              href={soundcloud}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-white/60 transition-colors hover:text-white hover:underline"
            >
              SoundCloud
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
