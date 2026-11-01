// Field limits for authoring Information versions (spec 0007). Kept free of
// server-only imports so both the client form and the Server Actions can use
// them (same split as lib/profile.ts).
export const VERSION_LABEL_MAX_LENGTH = 80;
export const TITLE_MAX_LENGTH = 200;
export const BODY_MAX_LENGTH = 100_000;
