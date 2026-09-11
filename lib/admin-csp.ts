function cleanNonce(value:string){return String(value||'').replace(/[^A-Za-z0-9+/_=-]/g,'').slice(0,160);}

export function buildAdminContentSecurityPolicy(nonce:string,isDevelopment=false){
  const safeNonce=cleanNonce(nonce);if(!safeNonce)throw new Error('CSP_NONCE_REQUIRED');
  const directives=[
    "default-src 'self'",
    `script-src 'self' 'nonce-${safeNonce}' 'strict-dynamic'${isDevelopment?" 'unsafe-eval'":''}`,
    "script-src-attr 'none'",
    // O painel ainda usa alguns style={} do React; script-src permanece estrito mesmo assim.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    'upgrade-insecure-requests',
  ];
  return directives.join('; ');
}
