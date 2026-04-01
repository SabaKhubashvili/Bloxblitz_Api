-- Session / device / fraud-minded tracking on game User.
-- All new columns use explicit defaults so existing users keep their rows (no table rewrite beyond ADD COLUMN).
ALTER TABLE "User" ADD COLUMN "last_known_ip" VARCHAR(64) DEFAULT NULL,
ADD COLUMN "last_user_agent" VARCHAR(512) DEFAULT NULL,
ADD COLUMN "last_device" VARCHAR(32) DEFAULT NULL,
ADD COLUMN "geo_country" VARCHAR(8) DEFAULT NULL,
ADD COLUMN "geo_city" VARCHAR(120) DEFAULT NULL,
ADD COLUMN "geo_timezone" VARCHAR(64) DEFAULT NULL,
ADD COLUMN "last_active_at" TIMESTAMP(3) DEFAULT NULL,
ADD COLUMN "login_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "ip_history" TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
ADD COLUMN "device_history" TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
ADD COLUMN "device_fingerprint" VARCHAR(128) DEFAULT NULL,
ADD COLUMN "is_vpn" BOOLEAN DEFAULT NULL,
ADD COLUMN "is_proxy" BOOLEAN DEFAULT NULL;
