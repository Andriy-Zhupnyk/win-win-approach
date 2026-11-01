// Field limits for the proposal workflow (spec 0009). Kept free of
// server-only imports so both the client forms and the Server Actions can use
// them (same split as lib/profile.ts).
export const PROPOSAL_BODY_MAX_LENGTH = 50_000;
export const REVIEW_NOTE_MAX_LENGTH = 2_000;
