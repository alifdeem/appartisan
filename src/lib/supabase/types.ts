/**
 * Database types.
 *
 * Hand-written to match supabase/migrations/*.sql, because the schema exists
 * before the Supabase project does. Once real keys are in .env.local, replace
 * this file with generated output:
 *
 *   npm run db:types
 *
 * Keep the enums in sync with 0001_init.sql — they are the contract the whole
 * app is written against.
 */

export type UserRole = "client" | "provider" | "admin";

export type VerificationStatus =
  | "unsubmitted"
  | "pending"
  | "approved"
  | "rejected"
  | "suspended";

export type ProviderAvailability = "offline" | "online" | "on_job";

export type JobStatus =
  | "draft"
  | "posted"
  | "matching"
  | "offer_sent"
  | "unmatched"
  | "assigned"
  | "quote_pending"
  | "quote_sent"
  | "awaiting_deposit"
  | "deposit_paid"
  | "en_route"
  | "arrived"
  | "in_progress"
  | "work_complete"
  | "awaiting_signoff"
  | "awaiting_balance"
  | "paid"
  | "closed"
  | "cancelled_by_client"
  | "cancelled_by_provider"
  | "expired_no_match"
  | "disputed";

export type OfferStatus = "pending" | "accepted" | "declined" | "expired" | "superseded";
export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";
export type QuoteItemKind = "labour" | "material";
export type PaymentLeg = "deposit" | "balance";
export type PaymentStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "refunded"
  | "cancelled";
export type PayoutStatus = "pending" | "processing" | "paid" | "failed";
export type MomoNetwork = "mtn" | "telecel" | "airteltigo";
export type DisputeStatus = "open" | "investigating" | "resolved" | "rejected";
export type NotificationChannel = "sms" | "push" | "in_app" | "whatsapp";
export type ProviderDocType =
  | "ghana_card_front"
  | "ghana_card_back"
  | "selfie"
  | "work_photo"
  | "certificate";
export type JobPhotoStage = "request" | "progress" | "completion";

/** Row, with `Optional` keys made optional on insert and everything optional on update. */
type Table<Row, Optional extends keyof Row = never> = {
  Row: Row;
  Insert: Omit<Row, Optional> & Partial<Pick<Row, Optional>>;
  Update: Partial<Row>;
  Relationships: [];
};

type Timestamps = { created_at: string };

export type ProfileRow = Timestamps & {
  id: string;
  role: UserRole;
  phone: string;
  full_name: string;
  avatar_url: string | null;
  spoken_languages: string[];
  is_active: boolean;
  updated_at: string;
}

export type ProviderRow = Timestamps & {
  profile_id: string;
  bio: string | null;
  years_experience: number | null;
  verification_status: VerificationStatus;
  availability: ProviderAvailability;
  current_location: unknown | null;
  last_location_at: string | null;
  service_radius_km: number;
  base_city: string | null;
  momo_number: string | null;
  momo_network: MomoNetwork | null;
  payout_recipient_code: string | null;
  rating_avg: number;
  rating_count: number;
  jobs_completed: number;
  suspended_at: string | null;
  suspension_reason: string | null;
  updated_at: string;
}

export type CategoryRow = Timestamps & {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

export type JobRow = Timestamps & {
  id: string;
  reference: string;
  client_id: string;
  provider_id: string | null;
  category_id: string;
  status: JobStatus;
  description: string | null;
  voice_note_path: string | null;
  location: unknown | null;
  address_text: string | null;
  ghanapost_code: string | null;
  landmark: string | null;
  matching_radius_km: number;
  matching_pass: number;
  quote_rejections: number;
  updated_at: string;
  closed_at: string | null;
  /**
   * STORED GENERATED mirrors of `location` (migration 0007). Read-only —
   * Postgres recomputes them, so they cannot drift from the point the matcher
   * measures against. Write the pin with the `set_job_location` RPC; PostGIS
   * geography arrives over PostgREST as WKB hex, which no map can read.
   */
  location_lng: number | null;
  location_lat: number | null;
}

export type JobPhotoRow = Timestamps & {
  id: string;
  job_id: string;
  storage_path: string;
  stage: JobPhotoStage;
  uploaded_by: string;
}

/**
 * The audit log. Append-only: written by the `log_job_status_change` trigger
 * and by nothing else, which is the only way a trail stays worth reading when a
 * dispute arrives six weeks later (PLAN.md §6).
 */
export type JobEventRow = Timestamps & {
  id: string;
  job_id: string;
  from_status: JobStatus | null;
  to_status: JobStatus;
  actor_id: string | null;
  actor_role: UserRole | null;
  reason: string | null;
  metadata: Record<string, unknown>;
}

export type OtpChallengeRow = Timestamps & {
  id: string;
  phone: string;
  code_hash: string;
  purpose: string;
  attempts: number;
  max_attempts: number;
  expires_at: string;
  consumed_at: string | null;
  created_ip: string | null;
}

export type NotificationLogRow = Timestamps & {
  id: string;
  recipient_phone: string | null;
  recipient_id: string | null;
  channel: NotificationChannel;
  template: string;
  body: string;
  cost: number;
  currency: string;
  provider_message_id: string | null;
  status: string;
  is_simulated: boolean;
}

export type PaymentRow = Timestamps & {
  id: string;
  job_id: string;
  leg: PaymentLeg;
  amount: number;
  currency: string;
  status: PaymentStatus;
  channel: string | null;
  momo_network: MomoNetwork | null;
  provider_reference: string;
  is_simulated: boolean;
  failure_reason: string | null;
  raw_payload: unknown | null;
  paid_at: string | null;
}

export type PayoutRow = {
  id: string;
  job_id: string;
  provider_id: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  transfer_reference: string | null;
  is_simulated: boolean;
  failure_reason: string | null;
  raw_payload: unknown | null;
  initiated_at: string;
  settled_at: string | null;
}

export type TransportZoneRow = Timestamps & {
  id: string;
  city: string;
  min_km: number;
  max_km: number;
  fee: number;
  provider_share_pct: number;
  is_active: boolean;
}

export type SettingRow = {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

export type ClientRow = Timestamps & {
  profile_id: string;
  default_address: string | null;
}

export type ProviderDocumentRow = {
  id: string;
  provider_id: string;
  doc_type: ProviderDocType;
  storage_path: string;
  uploaded_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: Table<ProfileRow, "created_at" | "updated_at" | "avatar_url" | "spoken_languages" | "is_active" | "role">;
      clients: Table<ClientRow, "created_at" | "default_address">;
      providers: Table<
        ProviderRow,
        | "created_at"
        | "updated_at"
        | "bio"
        | "years_experience"
        | "verification_status"
        | "availability"
        | "current_location"
        | "last_location_at"
        | "service_radius_km"
        | "base_city"
        | "momo_number"
        | "momo_network"
        | "payout_recipient_code"
        | "rating_avg"
        | "rating_count"
        | "jobs_completed"
        | "suspended_at"
        | "suspension_reason"
      >;
      provider_documents: Table<ProviderDocumentRow, "id" | "uploaded_at">;
      categories: Table<CategoryRow, "id" | "created_at" | "description" | "is_active" | "sort_order" | "icon">;
      jobs: Table<
        JobRow,
        | "id"
        | "reference"
        | "created_at"
        | "updated_at"
        | "closed_at"
        | "provider_id"
        | "status"
        | "description"
        | "voice_note_path"
        | "location"
        | "address_text"
        | "ghanapost_code"
        | "landmark"
        | "matching_radius_km"
        | "matching_pass"
        | "quote_rejections"
        // Generated by Postgres; never supplied on write.
        | "location_lng"
        | "location_lat"
      >;
      job_photos: Table<JobPhotoRow, "id" | "created_at" | "stage">;
      job_events: Table<JobEventRow, "id" | "created_at" | "metadata" | "reason">;
      otp_challenges: Table<
        OtpChallengeRow,
        "id" | "created_at" | "purpose" | "attempts" | "max_attempts" | "consumed_at" | "created_ip"
      >;
      notifications_log: Table<
        NotificationLogRow,
        | "id"
        | "created_at"
        | "recipient_phone"
        | "recipient_id"
        | "cost"
        | "currency"
        | "provider_message_id"
        | "status"
        | "is_simulated"
      >;
      payments: Table<
        PaymentRow,
        | "id"
        | "created_at"
        | "currency"
        | "status"
        | "channel"
        | "momo_network"
        | "is_simulated"
        | "failure_reason"
        | "raw_payload"
        | "paid_at"
      >;
      payouts: Table<
        PayoutRow,
        | "id"
        | "currency"
        | "status"
        | "transfer_reference"
        | "is_simulated"
        | "failure_reason"
        | "raw_payload"
        | "initiated_at"
        | "settled_at"
      >;
      transport_zones: Table<TransportZoneRow, "id" | "created_at" | "provider_share_pct" | "is_active">;
      settings: Table<SettingRow, "description" | "updated_at" | "updated_by">;
    };
    Views: Record<string, never>;
    Functions: {
      current_user_role: { Args: Record<string, never>; Returns: UserRole };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      find_candidate_providers: {
        Args: { p_job_id: string; p_radius_km?: number; p_limit?: number };
        Returns: { provider_id: string; distance_km: number; rating_avg: number }[];
      };
      compute_quote_totals: {
        Args: { p_subtotal: number; p_service_fee_pct: number; p_transport_fee: number };
        Returns: { service_fee_amount: number; total: number; deposit_amount: number }[];
      };
      transport_fee_for_distance: {
        Args: { p_city: string; p_distance_km: number };
        Returns: number;
      };
      set_provider_location: {
        Args: { p_provider_id: string; p_lng: number; p_lat: number };
        Returns: undefined;
      };
      record_location_ping: {
        Args: { p_job_id: string; p_lng: number; p_lat: number; p_accuracy_m?: number };
        Returns: undefined;
      };
      /**
       * Phase 1 (migration 0007). PostGIS writes and the draft → posted
       * transition both have to go through a function: geography cannot be
       * written over PostgREST, and `guard_jobs_columns` refuses a participant
       * status change from anywhere else.
       */
      set_job_location: {
        Args: {
          p_job_id: string;
          p_lng: number;
          p_lat: number;
          p_address_text?: string | null;
          p_ghanapost_code?: string | null;
          p_landmark?: string | null;
        };
        Returns: undefined;
      };
      // Both return void: the caller re-reads the job through RLS afterwards
      // rather than trusting a composite echoed back from a definer function.
      post_job: { Args: { p_job_id: string }; Returns: undefined };
      cancel_job: { Args: { p_job_id: string; p_reason?: string | null }; Returns: undefined };
    };
    Enums: {
      user_role: UserRole;
      verification_status: VerificationStatus;
      job_status: JobStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
