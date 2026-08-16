/** Prisma `UserRole` — admin surfaces require the exact ADMIN value. */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === "ADMIN";
}
