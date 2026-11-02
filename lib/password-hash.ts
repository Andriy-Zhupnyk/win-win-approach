// Single source of truth for the bcrypt work factor, shared by registration
// and the owner-run scripts (admin:create, db:seed:demo) so a password hashed
// by any of them is verified the same way by the Credentials provider.
export const BCRYPT_COST = 12;

// Minimum length enforced on registration; the demo-account seed reuses it.
export const MIN_PASSWORD_LENGTH = 8;
