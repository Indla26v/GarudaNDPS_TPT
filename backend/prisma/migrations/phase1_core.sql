-- Phase 1 core schema (run if not using prisma db push)
CREATE TYPE station_type AS ENUM ('POLICE', 'EXCISE');
CREATE TYPE case_department AS ENUM ('POLICE', 'EXCISE');
CREATE TYPE contraband_type AS ENUM ('DRY_GANJA', 'GANJA_OIL', 'BROWN_SUGAR', 'HEROIN', 'MDMA', 'SYNTHETIC', 'COCAINE', 'OPIUM', 'OTHER');
CREATE TYPE quantity_unit AS ENUM ('KG', 'GRAMS', 'ML', 'TABLETS', 'STRIPS', 'PACKETS');
CREATE TYPE bail_status AS ENUM ('PENDING', 'GRANTED', 'REJECTED', 'CANCELLED');

ALTER TABLE police_stations ADD COLUMN IF NOT EXISTS station_type station_type NOT NULL DEFAULT 'POLICE';

ALTER TABLE cases ADD COLUMN IF NOT EXISTS nature_of_offence VARCHAR(500);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS contraband_type contraband_type;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS quantity DECIMAL(12,3);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS quantity_unit quantity_unit;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS street_value DECIMAL(15,2);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS source_location VARCHAR(300);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS destination_location VARCHAR(300);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS intelligence_notes TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS department case_department NOT NULL DEFAULT 'POLICE';
