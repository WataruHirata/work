// Next.js discovers proxy next to src/app. Keep the implementation shared with the root entry.
export { proxy } from "../proxy";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
