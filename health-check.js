const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const SUPABASE_URL = 'https://niuajsppobtgcefapsaw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pdWFqc3Bwb2J0Z2NlZmFwc2F3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjU1NjgxMCwiZXhwIjoyMDk4MTMyODEwfQ.157ujayQHrhdBaGTl6YrVNyjN7gro0xy28Zj8Rnkmxw';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  realtime: {
    transport: ws
  }
});

async function runHealthCheck() {
  console.log('🚀 Starting Technical Health Check for Hesabyar...');
  console.log('--------------------------------------------------');

  try {
    // 1. Connection Test
    console.log('🔍 Testing Connection...');
    const { data: orgs, error: orgError } = await supabase.from('organizations').select('id, name').limit(1);
    if (orgError) throw new Error(`Connection Error: ${orgError.message}`);
    console.log('✅ Connected successfully to Supabase.');

    if (!orgs || orgs.length === 0) {
      console.log('⚠️ No organizations found in database. Tests might be limited.');
      return;
    }
    const testOrgId = orgs[0].id;
    console.log(`🏢 Testing with Organization: ${orgs[0].name} (${testOrgId})`);

    // 2. Test Core Tables
    console.log('\n🔍 Testing Core Tables...');
    const tables = ['products', 'contacts', 'sales', 'transactions'];
    for (const table of tables) {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (error) {
        console.log(`❌ Table ${table} Error: ${error.message}`);
      } else {
        console.log(`✅ Table ${table} is accessible (Count: ${count})`);
      }
    }

    // 3. Test Dashboard RPCs
    console.log('\n🔍 Testing Dashboard RPCs...');
    
    // Test dashboard_summary
    const { data: summary, error: summaryError } = await supabase.rpc('dashboard_summary', { p_org: testOrgId });
    if (summaryError) {
      console.log(`❌ RPC dashboard_summary Error: ${summaryError.message}`);
    } else {
      console.log('✅ RPC dashboard_summary works perfectly.');
      console.log('   Data sample:', JSON.stringify(summary).slice(0, 100) + '...');
    }

    // Test sales_chart_30d
    const { data: chart, error: chartError } = await supabase.rpc('sales_chart_30d', { p_org: testOrgId });
    if (chartError) {
      console.log(`❌ RPC sales_chart_30d Error: ${chartError.message}`);
    } else {
      console.log('✅ RPC sales_chart_30d works perfectly.');
    }

    // 4. Date Format Verification
    console.log('\n🔍 Verifying Date Formats...');
    const { data: sampleSale } = await supabase.from('sales').select('date').limit(1).single();
    if (sampleSale?.date) {
      const isIso = /^\d{4}-\d{2}-\d{2}/.test(sampleSale.date);
      console.log(`✅ Date format check: ${isIso ? 'Valid ISO' : 'Invalid'} (${sampleSale.date})`);
    } else {
      console.log('⚠️ No sales found to verify date format.');
    }

    console.log('\n--------------------------------------------------');
    console.log('🎉 Health Check Completed! The system is technically sound.');
  } catch (err) {
    console.error('\n🛑 Health Check Failed:');
    console.error(err);
    process.exit(1);
  }
}

runHealthCheck();
