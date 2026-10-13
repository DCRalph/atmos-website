"use client";

import { useParams } from "next/navigation";

import { AccessLevelEditor } from "~/components/admin/ticketing/access-level-editor";

export default function EditAccessLevelPage() {
  const params = useParams<{ code: string }>();
  return <AccessLevelEditor code={params.code} />;
}
