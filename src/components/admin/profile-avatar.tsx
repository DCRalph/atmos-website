import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

/** A round artist or crew photo for admin lists, with initials when there isn't one. */
export function ProfileAvatar({
  src,
  name,
  className,
}: {
  src: string | null;
  name: string;
  className?: string;
}) {
  return (
    <Avatar className={cn("size-8", className)}>
      {src ? <AvatarImage src={src} alt="" className="object-cover" /> : null}
      <AvatarFallback className="text-muted-foreground text-xs font-medium">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
