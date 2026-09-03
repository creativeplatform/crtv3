-- Shoppable video overlays: campaigns, product kits, videos, temporal annotations.
-- Access model: public SELECT for active in-window campaigns; writes via service-role API routes.

DO $$ BEGIN
  CREATE TYPE public.shoppable_campaign_status AS ENUM (
    'pending',
    'active',
    'rejected',
    'expired'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.shoppable_detection_status AS ENUM (
    'idle',
    'queued',
    'processing',
    'ready',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.shoppable_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_proposal_id text UNIQUE,
  brand_address text NOT NULL,
  creator_address text NOT NULL,
  status public.shoppable_campaign_status NOT NULL DEFAULT 'pending',
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  budget_usdc numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shoppable_campaigns_brand_lower CHECK (brand_address ~ '^0x[a-f0-9]{40}$'),
  CONSTRAINT shoppable_campaigns_creator_lower CHECK (creator_address ~ '^0x[a-f0-9]{40}$'),
  CONSTRAINT shoppable_campaigns_dates CHECK (end_date > start_date),
  CONSTRAINT shoppable_campaigns_budget_nonnegative CHECK (budget_usdc IS NULL OR budget_usdc >= 0)
);

CREATE INDEX IF NOT EXISTS idx_shoppable_campaigns_creator
  ON public.shoppable_campaigns (creator_address);

CREATE INDEX IF NOT EXISTS idx_shoppable_campaigns_brand
  ON public.shoppable_campaigns (brand_address);

CREATE INDEX IF NOT EXISTS idx_shoppable_campaigns_status
  ON public.shoppable_campaigns (status);

CREATE INDEX IF NOT EXISTS idx_shoppable_campaigns_active_window
  ON public.shoppable_campaigns (start_date, end_date)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.shoppable_product_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL
    REFERENCES public.shoppable_campaigns(id) ON DELETE CASCADE,
  ipfs_hash text NOT NULL,
  brand_name text NOT NULL,
  brand_handle text NOT NULL,
  brand_logo_url text NOT NULL,
  product_image_url text NOT NULL,
  purchase_url text NOT NULL,
  title text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shoppable_product_kits_campaign_unique UNIQUE (campaign_id),
  CONSTRAINT shoppable_product_kits_id_campaign_unique UNIQUE (id, campaign_id)
);

CREATE TABLE IF NOT EXISTS public.shoppable_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL
    REFERENCES public.shoppable_campaigns(id) ON DELETE CASCADE,
  livepeer_asset_id text NOT NULL,
  livepeer_playback_id text NOT NULL,
  video_asset_id integer REFERENCES public.video_assets(id) ON DELETE SET NULL,
  duration double precision,
  detection_status public.shoppable_detection_status NOT NULL DEFAULT 'idle',
  detection_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shoppable_videos_campaign_unique UNIQUE (campaign_id),
  CONSTRAINT shoppable_videos_id_campaign_unique UNIQUE (id, campaign_id),
  CONSTRAINT shoppable_videos_livepeer_asset_unique UNIQUE (livepeer_asset_id),
  CONSTRAINT shoppable_videos_livepeer_playback_unique UNIQUE (livepeer_playback_id),
  CONSTRAINT shoppable_videos_duration_nonnegative CHECK (duration IS NULL OR duration >= 0)
);

CREATE INDEX IF NOT EXISTS idx_shoppable_videos_detection
  ON public.shoppable_videos (detection_status);

CREATE INDEX IF NOT EXISTS idx_shoppable_videos_video_asset
  ON public.shoppable_videos (video_asset_id);

CREATE TABLE IF NOT EXISTS public.shoppable_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  video_id uuid NOT NULL,
  product_kit_id uuid NOT NULL,
  start_time double precision NOT NULL,
  end_time double precision NOT NULL,
  bounding_box integer[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shoppable_annotations_campaign_fk
    FOREIGN KEY (campaign_id)
    REFERENCES public.shoppable_campaigns(id)
    ON DELETE CASCADE,
  CONSTRAINT shoppable_annotations_video_campaign_fk
    FOREIGN KEY (video_id, campaign_id)
    REFERENCES public.shoppable_videos(id, campaign_id)
    ON DELETE CASCADE,
  CONSTRAINT shoppable_annotations_product_campaign_fk
    FOREIGN KEY (product_kit_id, campaign_id)
    REFERENCES public.shoppable_product_kits(id, campaign_id)
    ON DELETE CASCADE,
  CONSTRAINT shoppable_annotations_times_valid CHECK (
    start_time >= 0
    AND end_time > start_time
  ),
  CONSTRAINT shoppable_annotations_bbox_len CHECK (cardinality(bounding_box) = 4),
  CONSTRAINT shoppable_annotations_bbox_values CHECK (
    bounding_box[1] BETWEEN 0 AND 1000 AND
    bounding_box[2] BETWEEN 0 AND 1000 AND
    bounding_box[3] BETWEEN 0 AND 1000 AND
    bounding_box[4] BETWEEN 0 AND 1000 AND
    bounding_box[3] >= bounding_box[1] AND
    bounding_box[4] >= bounding_box[2]
  )
);

CREATE INDEX IF NOT EXISTS idx_shoppable_annotations_video
  ON public.shoppable_annotations (video_id, start_time);

CREATE INDEX IF NOT EXISTS idx_shoppable_annotations_campaign
  ON public.shoppable_annotations (campaign_id);

CREATE INDEX IF NOT EXISTS idx_shoppable_annotations_product_campaign
  ON public.shoppable_annotations (product_kit_id, campaign_id);

CREATE INDEX IF NOT EXISTS idx_shoppable_annotations_video_campaign
  ON public.shoppable_annotations (video_id, campaign_id);

COMMENT ON TABLE public.shoppable_campaigns IS 'Brand shoppable overlay campaigns linked to Snapshot proposals';
COMMENT ON TABLE public.shoppable_product_kits IS 'Grove-backed product kit metadata for a campaign';
COMMENT ON TABLE public.shoppable_videos IS 'Creator Livepeer VOD linked to a shoppable campaign';
COMMENT ON TABLE public.shoppable_annotations IS 'Gemini temporal product detections [ymin,xmin,ymax,xmax] on 0-1000 grid';

CREATE OR REPLACE FUNCTION public.set_shoppable_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shoppable_campaigns_updated_at ON public.shoppable_campaigns;
CREATE TRIGGER shoppable_campaigns_updated_at
  BEFORE UPDATE ON public.shoppable_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_shoppable_updated_at();

DROP TRIGGER IF EXISTS shoppable_videos_updated_at ON public.shoppable_videos;
CREATE TRIGGER shoppable_videos_updated_at
  BEFORE UPDATE ON public.shoppable_videos
  FOR EACH ROW EXECUTE FUNCTION public.set_shoppable_updated_at();

ALTER TABLE public.shoppable_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shoppable_product_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shoppable_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shoppable_annotations ENABLE ROW LEVEL SECURITY;

-- Public SELECT only for active campaigns within their date window.
DROP POLICY IF EXISTS shoppable_campaigns_select_active ON public.shoppable_campaigns;
CREATE POLICY shoppable_campaigns_select_active
  ON public.shoppable_campaigns
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'active'
    AND start_date <= now()
    AND end_date >= now()
  );

DROP POLICY IF EXISTS shoppable_product_kits_select_active ON public.shoppable_product_kits;
CREATE POLICY shoppable_product_kits_select_active
  ON public.shoppable_product_kits
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shoppable_campaigns c
      WHERE c.id = campaign_id
        AND c.status = 'active'
        AND c.start_date <= now()
        AND c.end_date >= now()
    )
  );

DROP POLICY IF EXISTS shoppable_videos_select_active ON public.shoppable_videos;
CREATE POLICY shoppable_videos_select_active
  ON public.shoppable_videos
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shoppable_campaigns c
      WHERE c.id = campaign_id
        AND c.status = 'active'
        AND c.start_date <= now()
        AND c.end_date >= now()
    )
  );

DROP POLICY IF EXISTS shoppable_annotations_select_active ON public.shoppable_annotations;
CREATE POLICY shoppable_annotations_select_active
  ON public.shoppable_annotations
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.shoppable_videos v
      JOIN public.shoppable_campaigns c ON c.id = v.campaign_id
      WHERE v.id = video_id
        AND c.status = 'active'
        AND c.start_date <= now()
        AND c.end_date >= now()
    )
  );

-- Strict public access: revoke from public, then grant exact client privileges.
REVOKE ALL ON public.shoppable_campaigns FROM public;
REVOKE ALL ON public.shoppable_product_kits FROM public;
REVOKE ALL ON public.shoppable_videos FROM public;
REVOKE ALL ON public.shoppable_annotations FROM public;

GRANT SELECT ON public.shoppable_campaigns TO anon, authenticated;
GRANT SELECT ON public.shoppable_product_kits TO anon, authenticated;
GRANT SELECT ON public.shoppable_videos TO anon, authenticated;
GRANT SELECT ON public.shoppable_annotations TO anon, authenticated;

GRANT ALL ON public.shoppable_campaigns TO service_role;
GRANT ALL ON public.shoppable_product_kits TO service_role;
GRANT ALL ON public.shoppable_videos TO service_role;
GRANT ALL ON public.shoppable_annotations TO service_role;
