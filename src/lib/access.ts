export const MAIN_ADMIN_EMAIL = "sanjifile@gmail.com";
export function isMainAdmin(email?: string) {
  return email?.trim().toLowerCase() === MAIN_ADMIN_EMAIL;
}
export function hasAppAccess(user: {
  email?: string;
  email_confirmed_at?: string | null;
  app_metadata?: Record<string, unknown>;
}) {
  return (
    !!user.email_confirmed_at &&
    (isMainAdmin(user.email) || user.app_metadata?.fun_liga_access === true)
  );
}
