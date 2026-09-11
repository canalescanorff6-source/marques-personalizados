import assert from 'node:assert/strict';
process.env.SESSION_SECRET='marques-recovery-self-test-session-secret-2026-long-enough';
const {generateAdminRecoveryCodes,hashAdminRecoveryCode,isAdminRecoveryCode,normalizeAdminRecoveryCode}=await import('../lib/recovery-codes.ts');
const codes=generateAdminRecoveryCodes(20);
assert.equal(codes.length,20,'deve gerar a quantidade solicitada');
assert.equal(new Set(codes).size,20,'códigos devem ser únicos');
for(const code of codes){
  assert.match(code,/^[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){3}$/,'formato amigável inválido');
  assert.equal(isAdminRecoveryCode(code),true,'código gerado deve ser aceito pelo parser');
  assert.equal(normalizeAdminRecoveryCode(` ${code.toLowerCase()} `),code.replaceAll('-',''),'normalização deve ser previsível');
  assert.match(hashAdminRecoveryCode(code),/^[0-9a-f]{64}$/,'hash HMAC-SHA256 inválido');
  assert.notEqual(hashAdminRecoveryCode(code),code,'servidor não deve persistir código em claro');
}
const hashes=codes.map(hashAdminRecoveryCode);
assert.equal(new Set(hashes).size,hashes.length,'hashes devem permanecer únicos');
assert.equal(isAdminRecoveryCode('OOOO-0000-IIII-1111'),false,'alfabeto deve rejeitar I/O/0/1');
console.log(`Recovery Codes Self-test: OK (${codes.length} códigos únicos, hashes HMAC-SHA256).`);
