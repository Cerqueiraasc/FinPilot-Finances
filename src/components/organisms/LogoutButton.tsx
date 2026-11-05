"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/atoms/Button";
import { useApiSubmit } from "@/lib/api/use-api-submit";

export function LogoutButton() {
  const router = useRouter();
  const { submit, pending } = useApiSubmit();
  return (
    <Button
      variant="ghost"
      className="w-11 px-0"
      aria-label="Sair"
      disabled={pending}
      onClick={async () => {
        const result = await submit("POST", "/api/auth/logout", undefined, { refresh: false });
        if (result.ok) {
          router.push("/login");
          router.refresh();
        }
      }}
    >
      <LogOut aria-hidden className="size-5" />
    </Button>
  );
}
