-- Insert initial test data

-- Test users
INSERT INTO zkp_test.users (id, address, created_at, last_login_at, is_active, permissions, settings)
VALUES 
  ('11111111-1111-1111-1111-111111111111', '0x1111111111111111111111111111111111111111', NOW(), NOW(), true, ARRAY['USER'], '{}'),
  ('22222222-2222-2222-2222-222222222222', '0x2222222222222222222222222222222222222222', NOW(), NOW(), true, ARRAY['USER', 'ADMIN'], '{}'),
  ('33333333-3333-3333-3333-333333333333', '0x3333333333333333333333333333333333333333', NOW(), NOW(), false, ARRAY['USER'], '{}');

-- Test wallets
INSERT INTO zkp_test.wallets (id, user_id, address, chain_id, type, created_at, last_used_at, is_archived)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 1, 'USER_CONNECTED', NOW(), NOW(), false),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 137, 'USER_CONNECTED', NOW(), NOW(), false),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '0xccccccccccccccccccccccccccccccccccccccccc', 1, 'TEMPORARY', NOW(), NOW(), false);

-- Test organizations
INSERT INTO zkp_test.organizations (id, name, created_at, updated_at, api_key, settings)
VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Test Organization', NOW(), NOW(), 'api-test-key-1', '{}');

-- Test organization users
INSERT INTO zkp_test.organization_users (id, user_id, organization_id, role, joined_at)
VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'OWNER', NOW());

-- Test proof templates
INSERT INTO zkp_test.proof_templates (id, organization_id, name, description, proof_type, threshold, expiry_period, created_at, updated_at, is_active, settings)
VALUES
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Standard KYC Test', 'Test template', 'STANDARD', '1000000000000000000', 2592000, NOW(), NOW(), true, '{}');