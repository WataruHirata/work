"use client";

import Button from "@mui/material/Button";
import Link from "next/link";
import type { ReactNode } from "react";

export function MaterialLinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button component={Link} href={href} variant="outlined">
      {children}
    </Button>
  );
}
