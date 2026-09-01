-- Enforce one campaign sticker per Snapshot proposal.

CREATE UNIQUE INDEX IF NOT EXISTS campaign_stickers_proposal_unique
  ON public.campaign_stickers (proposal_id);
