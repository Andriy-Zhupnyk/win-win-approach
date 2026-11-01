-- Spec 0007: at most one PUBLISHED InformationVersion at any time, enforced
-- by the database itself. Prisma's schema language cannot express a partial
-- (filtered) unique index, so it is declared here only. The indexed
-- expression is a constant, so every PUBLISHED row collides with every other.
CREATE UNIQUE INDEX "InformationVersion_single_published_key"
  ON "InformationVersion" ((true))
  WHERE "status" = 'PUBLISHED';
