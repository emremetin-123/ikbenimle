const test = require('node:test');
const assert = require('node:assert/strict');
const { createAdminIntegrationService } = require('../modules/integrations/adminIntegrationService');
const { connectionBodySchema } = require('../modules/integrations/integrationSchemas');
test('generic default and transfer failure recovery are represented correctly', async () => {
  assert.equal(connectionBodySchema.parse({ name: 'Genel bağlantı' }).provider, 'generic_bridge');
  let row = { id: 1, latest_transfer_status: 'failed' };
  const service = createAdminIntegrationService({ listConnections: async () => [row] }, {});
  assert.equal((await service.listConnections())[0].last_error_code, 'TRANSFER_FAILED');
  row = { ...row, latest_transfer_status: 'succeeded', last_error_code: 'OLD_ERROR', transfer_success_at: '2026-11-03 12:00:00' };
  const recovered = (await service.listConnections())[0];
  assert.equal(recovered.last_error_code, null);
  assert.equal(recovered.last_success_at, row.transfer_success_at);
});
