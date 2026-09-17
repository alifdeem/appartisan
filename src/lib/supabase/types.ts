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
  /** Ghana Card PIN, `GHA-#########-#`. Frozen once the application is in review. */
  ghana_card_number: string | null;
  application_submitted_at: string | null;
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

export type ProviderCategoryRow = {
  provider_id: string;
  category_id: string;
}

/**
 * One offer to one artisan. Written only by the matcher (migration 0011) —
 * there is deliberately no INSERT policy, so the sequence cannot be forged.
 */
export type JobOfferRow = {
  id: string;
  job_id: string;
  provider_id: string;
  sequence_no: number;
  distance_km: number | null;
  status: OfferStatus;
  sent_at: string;
  expires_at: string;
  responded_at: string | null;
}

/**
 * `subtotal` is what the ARTISAN asked for; `total` is what the CLIENT sees.
 * Both are shown to both parties on purpose (PLAN.md §4) — an artisan who
 * thinks the job is GHS 400 while the client is paying GHS 448 will have that
 * conversation on the doorstep.
 *
 * Every figure here is derived by `save_quote`, never sent from a browser.
 */
export type QuoteRow = {
  id: string;
  job_id: string;
  provider_id: string;
  status: QuoteStatus;
  subtotal: number;
  service_fee_pct: number;
  service_fee_amount: number;
  transport_fee: number;
  total: number;
  deposit_amount: number;
  notes: string | null;
  created_at: string;
  sent_at: string | null;
  responded_at: string | null;
}

/**
 * What the quote builder sends. Note what is absent: `amount`. The line total,
 * the subtotal, the service fee, the transport band and the deposit are all
 * computed by `save_quote`. A browser supplies descriptions and numbers to
 * multiply, never money.
 */
export interface QuoteItemInput {
  kind: QuoteItemKind;
  description: string;
  quantity: number;
  unit_price: number;
}

export type QuoteItemRow = {
  id: string;
  quote_id: string;
  kind: QuoteItemKind;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order: number;
}

/**
 * One row per admin decision, never updated.
 *
 * `decision` is the full verification_status enum rather than a narrower
 * approve/reject pair because a suspension is also a review — same table, same
 * notes field, same audit question six weeks later.
 */
export type VerificationReviewRow = {
  id: string;
  provider_id: string;
  admin_id: string;
  decision: VerificationStatus;
  call_notes: string | null;
  reviewed_at: string;
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
        | "ghana_card_number"
        | "application_submitted_at"
        | "payout_recipient_code"
        | "rating_avg"
        | "rating_count"
        | "jobs_completed"
        | "suspended_at"
        | "suspension_reason"
      >;
      provider_documents: Table<ProviderDocumentRow, "id" | "uploaded_at">;
      provider_categories: Table<ProviderCategoryRow, never>;
      verification_reviews: Table<VerificationReviewRow, "id" | "reviewed_at" | "call_notes">;
      job_offers: Table<JobOfferRow, "id" | "sent_at" | "status" | "distance_km" | "responded_at">;
      quotes: Table<
        QuoteRow,
        | "id"
        | "created_at"
        | "status"
        | "service_fee_pct"
        | "transport_fee"
        | "notes"
        | "sent_at"
        | "responded_at"
      >;
      quote_items: Table<QuoteItemRow, "id" | "quantity" | "sort_order">;
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

      /**
       * Phase 2 (migration 0008). Verification status is guarded against direct
       * writes, so every move through it is a function call.
       *
       * `provider_application_gaps` is the same function the submit RPC checks
       * against, exposed so the UI checklist and the gate cannot disagree —
       * it returns the sentences still standing between the artisan and the
       * queue, and an empty array means ready.
       */
      provider_application_gaps: { Args: { p_provider_id: string }; Returns: string[] };
      submit_provider_application: { Args: Record<string, never>; Returns: undefined };
      review_provider_application: {
        Args: {
          p_provider_id: string;
          p_decision: VerificationStatus;
          p_call_notes?: string | null;
        };
        Returns: undefined;
      };
      set_provider_availability: {
        Args: { p_online: boolean };
        Returns: ProviderAvailability;
      };

      /**
       * Phase 3 (migration 0011). Every one of these returns the status the
       * database settled on rather than the one the caller hoped for — an
       * artisan tapping Accept two seconds after somebody else did needs to be
       * told what actually happened, not what they asked for.
       *
       * `advance_matching` is intentionally absent: it is not granted to end
       * users, because a client who could call it directly could burn through
       * their own candidate list.
       */
      respond_to_offer: {
        Args: { p_offer_id: string; p_accept: boolean };
        Returns: JobStatus;
      };
      admin_assign_job: {
        Args: { p_job_id: string; p_provider_id: string };
        Returns: undefined;
      };
      /** Line items in, quote id out. Totals are derived server-side. */
      save_quote: {
        Args: { p_job_id: string; p_items: QuoteItemInput[]; p_notes?: string | null };
        Returns: string;
      };
      send_quote: { Args: { p_quote_id: string }; Returns: undefined };
      respond_to_quote: {
        Args: { p_quote_id: string; p_accept: boolean; p_reason?: string | null };
        Returns: JobStatus;
      };
      job_matching_progress: {
        Args: { p_job_id: string };
        Returns: {
          contacted: number;
          current_pass: number;
          radius_km: number;
          offer_expires_at: string | null;
        }[];
      };
      /** Called by pg_cron and by /api/cron/matching. Returns offers expired. */
      expire_stale_offers: { Args: Record<string, never>; Returns: number };

      /**
       * Phase 4 (migration 0012). Money.
       *
       * `settle_payment` is the only function that may mark a payment
       * succeeded, and it is not granted to end users — it runs from the
       * webhook handler under the service role. It is listed here because the
       * handler is typed against this interface, not because a browser can
       * reach it.
       */
      deposit_due_for_job: { Args: { p_job_id: string }; Returns: number };
      settle_payment: {
        Args: {
          p_reference: string;
          p_succeeded: boolean;
          p_reason?: string | null;
          p_channel?: string | null;
        };
        Returns: JobStatus | null;
      };
      refund_job_payments: {
        Args: { p_job_id: string; p_reason?: string | null };
        Returns: number;
      };
      /**
       * Phase 5 (migration 0015). Execution and money out.
       *
       * `advance_job_execution` checks the requested edge against a table of
       * legal transitions rather than trusting the caller's idea of what comes
       * next — an artisan who marks "arrived" without ever going en route
       * leaves a client watching a map that never moved.
       */
      advance_job_execution: {
        Args: { p_job_id: string; p_to: JobStatus };
        Returns: JobStatus;
      };
      sign_off_job: {
        Args: { p_job_id: string; p_signature: string; p_client_notes?: string | null };
        Returns: JobStatus;
      };
      balance_due_for_job: { Args: { p_job_id: string }; Returns: number };
      close_job: { Args: { p_job_id: string }; Returns: JobStatus };
      /** Backend only. Closes paid jobs the client never rated. */
      auto_close_paid_jobs: { Args: { p_after_days?: number }; Returns: number };

      stale_pending_payments: {
        Args: { p_older_than_minutes?: number };
        Returns: {
          payment_id: string;
          job_id: string;
          provider_reference: string;
          leg: PaymentLeg;
          amount: number;
          created_at: string;
        }[];
      };
    };
    Enums: {
      user_role: UserRole;
      verification_status: VerificationStatus;
      job_status: JobStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
