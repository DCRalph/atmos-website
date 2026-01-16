import { motion } from "framer-motion";

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
    <motion.a
      href={link}
      className="group relative overflow-hidden rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/10 sm:p-6 md:p-8"
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      exit={{ opacity: 0, y: 10 }}
      transition={{
        duration: 0.5,
        ease: "easeOut",
        delay: 0.18, // add ~180ms delay when entering view
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-semibold tracking-wider uppercase sm:px-3">
          {type}
        </span>
        <span className="text-xs text-white/60 sm:text-sm">
          {date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>

      <h3 className="mb-3 text-lg font-bold group-hover:text-white/90 sm:text-xl md:text-2xl">
        {title}
      </h3>
      <p className="text-sm text-white/60 sm:text-base">{description}</p>

      <div className="mt-4 flex items-center text-xs font-semibold text-white/80 group-hover:text-white sm:mt-6 sm:text-sm">
        Play Now →
      </div>
    </motion.a>
  );
}
