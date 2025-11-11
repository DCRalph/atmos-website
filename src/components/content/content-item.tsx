interface ContentItemProps {
  id: string;
  type: string;
  title: string;
  description: string;
  date: Date;
  link: string;
}

export function ContentItem({
  type,
  title,
  description,
  date,
  link,
}: ContentItemProps) {
  return (
    <a
      href={link}
      className="group relative overflow-hidden rounded-lg border border-white/10 bg-white/5 p-4 sm:p-6 md:p-8 backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/10"
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="rounded-full bg-white/10 px-2 sm:px-3 py-1 text-xs font-semibold uppercase tracking-wider">
          {type}
        </span>
        <span className="text-xs sm:text-sm text-white/60">
          {date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>

      <h3 className="mb-3 text-lg sm:text-xl md:text-2xl font-bold group-hover:text-white/90">
        {title}
      </h3>
      <p className="text-sm sm:text-base text-white/60">{description}</p>

      <div className="mt-4 sm:mt-6 flex items-center text-xs sm:text-sm font-semibold text-white/80 group-hover:text-white">
        Play Now →
      </div>
    </a>
  );
}

