"use client";

import { User } from "lucide-react";
import React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";

type Props = {
  src?: string | null;
  name?: string | null;
  className?: string;
  size?: number;
  alt?: string;
};

export default function UserAvatar({ src, name, className, size, alt }: Props) {
  return (
    <Avatar className={className}>
      {src ? (
        // AvatarImage expects a URL string
        <AvatarImage src={src} alt={alt ?? name ?? "User avatar"} />
      ) : (
        <AvatarFallback className="">
          <User className="text-muted-foreground" size={size ?? 16} />
        </AvatarFallback>
      )}
    </Avatar>
  );
}
