/**
 * Backfill attack_type from ai_response JSON
 *
 * This script extracts attack_type from the ai_response JSON field
 * and populates it into the attack_type column for all existing tasks.
 */

import { query } from '../db/connection';

async function backfillAttackType() {
  console.log('Starting attack_type backfill...\n');

  try {
    // Update all tasks that have ai_response but no attack_type
    const updateResult = await query(`
      UPDATE smart_analysis_tasks
      SET attack_type = (ai_response::json->>'attack_type')
      WHERE ai_response IS NOT NULL
        AND (attack_type IS NULL OR attack_type = '')
        AND ai_response::json->>'attack_type' IS NOT NULL
      RETURNING id, source_ip, attack_type
    `);

    console.log(`✅ Updated ${updateResult.rowCount} tasks with attack_type from ai_response`);

    if (updateResult.rowCount && updateResult.rowCount > 0) {
      console.log('\nUpdated tasks:');
      updateResult.rows.forEach(row => {
        console.log(`  - Task #${row.id} (${row.source_ip}): ${row.attack_type}`);
      });
    }

    // Show summary
    console.log('\n📊 Summary of tasks with attack_type:');
    const summaryResult = await query(`
      SELECT
        attack_type,
        COUNT(*) as count
      FROM smart_analysis_tasks
      WHERE attack_type IS NOT NULL AND attack_type != ''
      GROUP BY attack_type
      ORDER BY count DESC
    `);

    summaryResult.rows.forEach(row => {
      console.log(`  - ${row.attack_type}: ${row.count} tasks`);
    });

    console.log('\n✅ Backfill complete!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error during backfill:', error);
    process.exit(1);
  }
}

// Run the backfill
backfillAttackType();
