/**
 * The three seeded test accounts — one per role.
 *
 * Single source of truth shared by the seed script and the dev hints in the UI,
 * so the numbers on the login screen can never drift from the numbers actually
 * in the database. Safe to import from client components: there are no secrets
 * here, and these accounts only exist in a seeded dev/demo database.
 */

export interface SeedAccount {
  role: "client" | "provider" | "admin";
  phone: string;
  /** As typed on the login screen. */
  localPhone: string;
  fullName: string;
  label: string;
  description: string;
}

export const SEED_ACCOUNTS: SeedAccount[] = [
  {
    role: "client",
    phone: "+233241111111",
    localPhone: "024 111 1111",
    fullName: "Ama Boateng",
    label: "Client",
    description: "Books jobs, approves quotes, pays the deposit and balance.",
  },
  {
    role: "provider",
    phone: "+233242222222",
    localPhone: "024 222 2222",
    fullName: "Kwame Mensah",
    label: "Artisan",
    description: "Approved electrician in Accra. Receives offers and sends quotes.",
  },
  {
    role: "admin",
    phone: "+233243333333",
    localPhone: "024 333 3333",
    fullName: "ArtisanGH Admin",
    label: "Admin",
    description: "Verifies artisans, sets transport rates, resolves disputes.",
  },
];

export const seedAccountByRole = (role: SeedAccount["role"]) =>
  SEED_ACCOUNTS.find((a) => a.role === role)!;
