export const ADMIN_AGENDA_WINDOWS=[30,60,90,180] as const;
export type AdminAgendaDays=(typeof ADMIN_AGENDA_WINDOWS)[number];
export function normalizeAdminAgendaDays(value:unknown,fallback:AdminAgendaDays=60):AdminAgendaDays{
  const parsed=Number(value);return (ADMIN_AGENDA_WINDOWS as readonly number[]).includes(parsed)?parsed as AdminAgendaDays:fallback;
}
export function isAdminAgendaDays(value:unknown):value is AdminAgendaDays{
  const parsed=Number(value);return Number.isInteger(parsed)&&(ADMIN_AGENDA_WINDOWS as readonly number[]).includes(parsed);
}
