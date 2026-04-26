-- Fix mutable search_path on public.sync_burns_to_transactions
-- Sets an explicit search_path for predictable, safer behavior.
--
-- Schema (verified): metoken_burns stores addresses as bytea; the burn address
-- column is `burner` (not `"user"`), and amounts are `me_tokens_burned` /
-- `assets_returned`. The Unix timestamp column is `block_timestamp` (numeric).

CREATE OR REPLACE FUNCTION public.sync_burns_to_transactions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  metoken_uuid UUID;
BEGIN
  -- metoken_burns.me_token is bytea; metokens.address is 0x-prefixed text
  SELECT id INTO metoken_uuid
  FROM public.metokens
  WHERE LOWER(address) = LOWER('0x' || encode(NEW.me_token, 'hex'));

  IF metoken_uuid IS NOT NULL THEN
    INSERT INTO public.metoken_transactions (
      metoken_id,
      user_address,
      transaction_type,
      amount,
      collateral_amount,
      block_number,
      created_at
    )
    VALUES (
      metoken_uuid,
      '0x' || encode(NEW.burner, 'hex'),
      'burn',
      NEW.me_tokens_burned,
      NEW.assets_returned,
      NEW.block_number::BIGINT,
      to_timestamp(NEW.block_timestamp::double precision)
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
