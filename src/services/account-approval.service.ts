export const ACCOUNT_STATUS = {
  APPROVED: "APPROVED",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  SUSPENDED: "SUSPENDED",
} as const;

export const PLAN_OPTIONS = [
  { key: "ESSENTIAL", label: "Essencial" },
  { key: "PROFESSIONAL", label: "Profissional" },
  { key: "MULTICOMPANY", label: "Multiempresa" },
  { key: "ENTERPRISE", label: "Enterprise" },
] as const;

export function isCompanyReleased(company: { accountStatus?: string | null; planKey?: string | null }) {
  return company.accountStatus === ACCOUNT_STATUS.APPROVED && Boolean(company.planKey);
}

export function planLabel(planKey?: string | null) {
  return PLAN_OPTIONS.find((plan) => plan.key === planKey)?.label ?? "Sem plano";
}

export function isValidPlan(planKey: string) {
  return PLAN_OPTIONS.some((plan) => plan.key === planKey);
}
