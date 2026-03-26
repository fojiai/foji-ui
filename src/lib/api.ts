/**
 * Thin fetch wrapper that attaches the JWT token from cookies and
 * provides typed helpers for FojiApi endpoints.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

function getToken(): string | null {
  if (typeof document === "undefined") return null;
  return (
    document.cookie
      .split("; ")
      .find((row) => row.startsWith("foji_token="))
      ?.split("=")[1] ?? null
  );
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.error ?? res.statusText, data);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Multipart upload — does NOT set Content-Type so the browser can set the boundary. */
export async function apiFetchMultipart<T = unknown>(
  path: string,
  body: FormData
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { method: "POST", body, headers });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.error ?? res.statusText, data);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  token: string;
  user: { id: number; email: string; firstName: string; lastName: string; isSuperAdmin: boolean };
}

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  signup: (data: { email: string; password: string; firstName: string; lastName: string }) =>
    apiFetch<{ message: string }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  verifyEmail: (token: string) =>
    apiFetch<{ message: string }>(`/api/auth/verify-email?token=${token}`),

  forgotPassword: (email: string) =>
    apiFetch<{ message: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    apiFetch<{ message: string }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword }),
    }),

  /** Creates a company for the currently authenticated user. */
  createCompany: (data: { name: string; slug: string }) =>
    apiFetch<{ id: number; name: string; slug: string }>("/api/companies", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ─── Agents ──────────────────────────────────────────────────────────────────

export interface Agent {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  industryType: string;
  agentLanguage: string;
  systemPrompt: string;
  userPrompt: string;
  agentToken: string;
  whatsAppEnabled: boolean;
  whatsAppPhoneNumberId?: string;
  supportWhatsAppNumber?: string;
  salesWhatsAppNumber?: string;
  supportEmail?: string;
  salesEmail?: string;
}

export const agentsApi = {
  list: (companyId: number) =>
    apiFetch<Agent[]>(`/api/agents?companyId=${companyId}`),

  get: (_companyId: number, agentId: number) =>
    apiFetch<Agent>(`/api/agents/${agentId}`),

  create: (companyId: number, data: Partial<Agent>) =>
    apiFetch<Agent>("/api/agents", {
      method: "POST",
      body: JSON.stringify({ companyId, ...data }),
    }),

  update: (_companyId: number, agentId: number, data: Partial<Agent>) =>
    apiFetch<Agent>(`/api/agents/${agentId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (_companyId: number, agentId: number) =>
    apiFetch<void>(`/api/agents/${agentId}`, { method: "DELETE" }),

  regenerateToken: (_companyId: number, agentId: number) =>
    apiFetch<{ agentToken: string }>(`/api/agents/${agentId}/regenerate-token`, {
      method: "POST",
    }),
};

// ─── Files ───────────────────────────────────────────────────────────────────

export interface AgentFile {
  id: number;
  fileName: string;
  fileSizeBytes: number;
  contentType: string;
  processingStatus: string;
  extractedAt?: string;
  errorMessage?: string;
  agentId: number;
  createdAt: string;
}

export const filesApi = {
  list: (agentId: number) =>
    apiFetch<AgentFile[]>(`/api/files?agentId=${agentId}`),

  upload: (agentId: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetchMultipart<AgentFile>(`/api/files/upload?agentId=${agentId}`, formData);
  },

  delete: (fileId: number) =>
    apiFetch<void>(`/api/files/${fileId}`, { method: "DELETE" }),
};

// ─── Plans ───────────────────────────────────────────────────────────────────

export interface Plan {
  id: number;
  name: string;
  slug: string;
  monthlyPriceUsd: number;
  stripePriceId: string;
  maxAgents: number;
  hasWhatsApp: boolean;
  hasEscalationContacts: boolean;
  maxConversationsPerMonth: number;
  maxMessagesPerMonth: number;
  isActive: boolean;
  isPublic: boolean;
  customForCompanyId?: number;
}

export const plansApi = {
  /** Public plans only — used in billing page and onboarding */
  list: () => apiFetch<Plan[]>("/api/plans"),
  /** All plans including private/custom — admin only */
  listAll: () => apiFetch<Plan[]>("/api/plans?includeAll=true"),
  create: (data: Partial<Plan>) =>
    apiFetch<Plan>("/api/admin/plans", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Plan>) =>
    apiFetch<Plan>(`/api/admin/plans/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: number) =>
    apiFetch<void>(`/api/admin/plans/${id}`, { method: "DELETE" }),
};

// ─── AI Models ───────────────────────────────────────────────────────────────

export interface AIModel {
  id: number;
  name: string;
  displayName: string;
  provider: string;
  modelId: string;
  inputCostPer1M: number;
  outputCostPer1M: number;
  isActive: boolean;
  isDefault: boolean;
}

export const modelsApi = {
  list: () => apiFetch<AIModel[]>("/api/ai-models"),
  create: (data: Partial<AIModel>) =>
    apiFetch<AIModel>("/api/ai-models", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<AIModel>) =>
    apiFetch<AIModel>(`/api/ai-models/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: number) =>
    apiFetch<void>(`/api/ai-models/${id}`, { method: "DELETE" }),
};

// ─── Subscriptions ────────────────────────────────────────────────────────────

export interface SubscriptionPlan {
  id: number;
  name: string;
  maxAgents: number;
  hasWhatsApp: boolean;
  hasEscalationContacts: boolean;
  maxConversationsPerMonth: number;
  maxMessagesPerMonth: number;
}

export interface Subscription {
  id: number;
  /** Lowercase status from the API: "active" | "trialing" | "past_due" | "canceled" | "unpaid" */
  status: string;
  plan: SubscriptionPlan;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  trialEndsAt?: string;
  canceledAt?: string;
}

export const subscriptionsApi = {
  checkout: (companyId: number, planId: number) =>
    apiFetch<{ checkoutUrl: string }>("/api/subscriptions/checkout", {
      method: "POST",
      body: JSON.stringify({ companyId, planId }),
    }),

  portal: (companyId: number) =>
    apiFetch<{ portalUrl: string }>("/api/subscriptions/portal", {
      method: "POST",
      body: JSON.stringify({ companyId }),
    }),

  getSubscription: (companyId: number) =>
    apiFetch<Subscription | null>(`/api/subscriptions?companyId=${companyId}`),
};

// ─── Admin Companies ─────────────────────────────────────────────────────────

export type AccountType = "Business" | "Individual";

export interface AdminCompanyListItem {
  id: number;
  name: string;
  tradeName?: string;
  slug: string;
  accountType: AccountType;
  cpfCnpj?: string;
  ownerEmail: string;
  currentPlanName?: string;
  subscriptionStatus?: string;
  hasActiveSubscription: boolean;
  createdAt: string;
}

export interface AdminCompanyDetail {
  id: number;
  name: string;
  tradeName?: string;
  slug: string;
  description?: string;
  accountType: AccountType;
  cpfCnpj?: string;
  adminNotes?: string;
  stripeCustomerId?: string;
  memberCount: number;
  agentCount: number;
  currentPlanId?: number;
  currentPlanName?: string;
  currentPlanIsPublic?: boolean;
  subscriptionStatus?: string;
  subscriptionPeriodEnd?: string;
  subscriptionAssignedByAdminId?: number;
  subscriptionAdminNotes?: string;
  createdAt: string;
}

export const adminCompaniesApi = {
  list: (search?: string, page = 1, pageSize = 20) =>
    apiFetch<{ items: AdminCompanyListItem[]; total: number; page: number; pageSize: number }>(
      `/api/admin/companies?${new URLSearchParams({ ...(search ? { search } : {}), page: String(page), pageSize: String(pageSize) })}`
    ),

  get: (id: number) => apiFetch<AdminCompanyDetail>(`/api/admin/companies/${id}`),

  create: (data: {
    name: string; tradeName?: string; slug: string; accountType: AccountType;
    cpfCnpj?: string; description?: string; adminNotes?: string;
    ownerEmail: string; ownerFirstName?: string; ownerLastName?: string;
  }) => apiFetch<{ id: number }>("/api/admin/companies", { method: "POST", body: JSON.stringify(data) }),

  assignPlan: (companyId: number, planId: number, adminNotes?: string, periodEnd?: string) =>
    apiFetch<{ message: string }>(`/api/admin/companies/${companyId}/assign-plan`, {
      method: "POST",
      body: JSON.stringify({ planId, adminNotes, periodEnd: periodEnd ?? null }),
    }),

  removePlan: (companyId: number) =>
    apiFetch<void>(`/api/admin/companies/${companyId}/subscription`, { method: "DELETE" }),

  updateNotes: (companyId: number, notes: string | null) =>
    apiFetch<{ message: string }>(`/api/admin/companies/${companyId}/notes`, {
      method: "PATCH",
      body: JSON.stringify({ notes }),
    }),
};

// ─── Admin Invitations ───────────────────────────────────────────────────────

export interface SystemAdminInvitation {
  id: number;
  email: string;
  invitedByUserEmail: string;
  expiresAt: string;
  acceptedAt?: string;
}

export const adminApi = {
  listInvitations: () =>
    apiFetch<SystemAdminInvitation[]>("/api/admin/invitations"),

  inviteAdmin: (email: string) =>
    apiFetch<SystemAdminInvitation>("/api/admin/invitations", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  deleteInvitation: (id: number) =>
    apiFetch<void>(`/api/admin/invitations/${id}`, { method: "DELETE" }),

  getStats: () =>
    apiFetch<{ totalCompanies: number; totalUsers: number; totalAgents: number }>(
      "/api/admin/stats"
    ),
};

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface DailyStat {
  statDate: string;
  sessions: number;
  messages: number;
  inputTokens: number;
  outputTokens: number;
}

export interface CompanyStats {
  companyId: number;
  totalSessions: number;
  totalMessages: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  dailyStats: DailyStat[];
}

export const analyticsApi = {
  getCompanyStats: (companyId: number, from?: string, to?: string) => {
    const params = new URLSearchParams({ companyId: String(companyId) });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return apiFetch<CompanyStats>(`/api/companies/${companyId}/stats?${params}`);
  },
};
