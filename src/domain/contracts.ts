/** Database-neutral application boundary. No Supabase client/query types cross this file. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type DataRecord = { id: string; [key: string]: Json };
export type Resource =
  | "products"
  | "stores"
  | "areas"
  | "departments"
  | "sales"
  | "corrections"
  | "approvals"
  | "orders"
  | "orderLines"
  | "inventory"
  | "notifications"
  | "announcements"
  | "users"
  | "roles"
  | "audit"
  | "imports"
  | "jobs"
  | "devices"
  | "prices"
  | "campaigns"
  | "campaignItems"
  | "campaignTargets"
  | "campaignTasks"
  | "instructions"
  | "instructionTargets";
export type Command =
  | "confirmSales"
  | "requestCorrection"
  | "approveCorrection"
  | "finalizeMonth"
  | "createOrder"
  | "markRead"
  | "assignRole"
  | "revokeRole"
  | "retryJob"
  | "registerDevice"
  | "disableDevice"
  | "changeCampaignEligibility"
  | "createCampaign"
  | "publishCampaign"
  | "confirmCampaign"
  | "updateCampaignTask"
  | "importSales"
  | "importProfiles"
  | "editCampaign"
  | "sendInstruction"
  | "confirmInstruction";
export type Session = {
  userId: string;
  displayName: string;
  active: boolean;
  mustChangePassword: boolean;
  roles: string[];
  storeIds?: string[];
  areaIds?: string[];
};
export type QueryOptions = {
  storeId?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  correctionId?: string;
};
export type DataPage = {
  rows: DataRecord[];
  total: number;
  page: number;
  pageSize: number;
};
export type ActionResult = {
  error?: string;
  success?: string;
  secret?: string;
};

export interface BusinessRepository {
  list(resource: Resource, options?: QueryOptions): Promise<DataPage>;
  save(
    resource: "products" | "stores" | "users" | "announcements",
    values: Record<string, Json>,
    id?: string,
    expectedVersion?: string,
  ): Promise<void>;
  execute(command: Command, input: Record<string, Json>): Promise<Json>;
  storeSnapshot(deviceToken: string): Promise<Record<string, Json>>;
}

export interface IdentityProvider {
  session(): Promise<Session | null>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  changePassword(password: string): Promise<void>;
  resetPassword(email: string, redirectTo: string): Promise<void>;
  exchangeCode(code: string): Promise<void>;
  provisionUser(
    email: string,
    password: string,
    employeeCode: string,
    displayName: string,
  ): Promise<void>;
}

export interface IntegrationTransport {
  send(kind: string, idempotencyKey: string, payload: Json): Promise<Json>;
}
export type IntegrationJob = {
  id: string;
  kind: string;
  idempotencyKey: string;
  payload: Json;
  leaseId: string;
};
export type NormalPriceQuote = { priceYen: number; revision: string };
export interface IntegrationJobStore {
  claim(kinds: string[], limit: number): Promise<IntegrationJob[]>;
  finish(job: IntegrationJob, success: boolean, result: Json, error?: string): Promise<void>;
  restorePrice(productId: string, storeId: string): Promise<NormalPriceQuote | null>;
  promotionEligible(productId: string): Promise<boolean>;
  ingest(eventId: string, kind: string, rows: Json[]): Promise<Json>;
}
