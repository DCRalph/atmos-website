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
    <div className="group relative overflow-hidden rounded-lg border border-white/10 bg-white/5 p-4 sm:p-6 md:p-8 backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/10">
      <div className="mb-4 sm:mb-6 aspect-square w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 relative rounded-full overflow-hidden bg-white/10 mx-auto flex items-center justify-center">
        <Image src={image} alt={name} fill className="object-cover" />
      </div>

      <div className="text-center">
        <h3 className="mb-2 text-xl sm:text-2xl font-bold">{name}</h3>
        <p className="mb-4 sm:mb-6 text-xs sm:text-sm font-semibold uppercase tracking-wider text-white/60">
          {role}
        </p>

        <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
          {instagram && (
            <Link
              href={instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/60 hover:text-white hover:underline transition-colors flex gap-1 sm:gap-2 items-center text-sm"
            >
              <>
                <FaInstagram className="w-4 h-4" />
                <span className="hidden sm:inline">Instagram</span>
              </>
            </Link>
          )}
          {soundcloud && (
            <Link
              href={soundcloud}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/60 hover:text-white hover:underline transition-colors text-sm"
            >
              SoundCloud
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

