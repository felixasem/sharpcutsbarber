export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export type UserRole = "customer" | "barber" | "admin";

// ── Table row types ────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  full_name: string;
  phone_whatsapp: string;
  role: UserRole;
  whatsapp_opt_in: boolean;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  is_addon: boolean;
  is_active: boolean;
  sort_order: number;
  image_url: string | null;
  created_at: string;
}

export interface BarberSchedule {
  id: string;
  barber_id: string;
  day_of_week: number; // 0=Sun, 6=Sat
  start_time: string;  // HH:MM:SS
  end_time: string;
  is_working: boolean;
}

export interface Appointment {
  id: string;
  customer_id: string;
  barber_id: string;
  service_id: string;
  appointment_time: string;
  end_time: string;
  status: AppointmentStatus;
  notes: string | null;
  total_price: number;
  promotion_id: string | null;
  discount_amount: number;
  reminder_24h_sent: boolean;
  reminder_2h_sent: boolean;
  confirmation_sent: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppointmentAddon {
  appointment_id: string;
  service_id: string;
  price: number;
}

export interface Promotion {
  id: string;
  code: string;
  description: string;
  discount_percent: number;
  active: boolean;
  valid_from: string;
  valid_until: string | null;
  max_uses: number | null;
  current_uses: number;
  created_by: string | null;
  created_at: string;
}

export interface WhatsAppMessageLog {
  id: string;
  recipient_phone: string;
  template_name: string;
  template_variables: Json | null;
  provider: "twilio" | "meta";
  provider_message_id: string | null;
  status: "pending" | "sent" | "delivered" | "failed";
  error_message: string | null;
  appointment_id: string | null;
  sent_at: string | null;
  created_at: string;
}

// ── Joined / view types (used in queries) ─────────────────────────────────────

export interface AppointmentWithRelations extends Appointment {
  customer: Profile;
  barber: Profile;
  service: Service;
  addons: Array<AppointmentAddon & { service: Service }>;
  promotion: Promotion | null;
}

export interface TimeSlot {
  time: Date;
  available: boolean;
}

// ── Form / input types ─────────────────────────────────────────────────────────

export interface BookingFormData {
  barberId: string;
  serviceId: string;
  addonIds: string[];
  appointmentTime: Date;
  promoCode?: string;
  notes?: string;
}

export interface CreateBookingPayload extends BookingFormData {
  customerId: string;
}

export interface PromotionValidationResult {
  valid: boolean;
  promotion?: Promotion;
  error?: string;
}
