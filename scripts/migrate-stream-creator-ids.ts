/**
 * One-time migration: update streams.creator_id from EOA/controller to smart account.
 *
 * Usage: npx tsx scripts/migrate-stream-creator-ids.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/** EOA/controller address -> smart account address */
const addressMappings: Record<string, string> = {
  '0x98c08b106c7e4fa5c8a655a3f75f3b3f553e760e': '0x2953B96F9160955f6256c9D444F8F7950E6647Df',
};

async function migrateStreamCreatorIds() {
  console.log('Starting streams creator_id migration...\n');

  for (const [legacyAddress, smartAccountAddress] of Object.entries(addressMappings)) {
    const legacy = legacyAddress.toLowerCase();
    const sca = smartAccountAddress.toLowerCase();
    console.log(`Processing: ${legacy} -> ${sca}`);

    try {
      const { data: legacyStream, error: fetchError } = await supabase
        .from('streams')
        .select('id, creator_id, playback_id, name')
        .ilike('creator_id', legacy)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      if (!legacyStream) {
        console.log('   No stream found for legacy address');
        continue;
      }

      console.log(`   Found stream: ${legacyStream.playback_id} (${legacyStream.name ?? 'unnamed'})`);

      const { data: scaStream } = await supabase
        .from('streams')
        .select('id')
        .ilike('creator_id', sca)
        .maybeSingle();

      if (scaStream) {
        console.log('   Stream already exists for smart account — skipping update');
        continue;
      }

      const { data: updated, error: updateError } = await supabase
        .from('streams')
        .update({
          creator_id: sca,
          updated_at: new Date().toISOString(),
        })
        .eq('id', legacyStream.id)
        .select('id, creator_id, playback_id')
        .single();

      if (updateError) {
        throw updateError;
      }

      console.log(`   Migrated stream ${updated.id} -> creator_id ${updated.creator_id}`);
    } catch (error) {
      console.error(`   Error processing ${legacy}:`, error);
    }
  }

  console.log('\nStreams creator_id migration complete.\n');
}

migrateStreamCreatorIds()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
