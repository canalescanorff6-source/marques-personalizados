import { ADMIN_AGENDA_WINDOWS, isAdminAgendaDays, normalizeAdminAgendaDays } from '../lib/agenda-window.ts';
const expected='30,60,90,180';
if(ADMIN_AGENDA_WINDOWS.join(',')!==expected)throw new Error(`Janelas inesperadas: ${ADMIN_AGENDA_WINDOWS.join(',')}`);
for(const value of ADMIN_AGENDA_WINDOWS){if(!isAdminAgendaDays(value))throw new Error(`Janela válida rejeitada: ${value}`);if(normalizeAdminAgendaDays(String(value))!==value)throw new Error(`Normalização falhou: ${value}`);}
for(const value of [0,29,31,365,'x',null,undefined])if(isAdminAgendaDays(value))throw new Error(`Janela inválida aceita: ${String(value)}`);
if(normalizeAdminAgendaDays(365)!==60)throw new Error('Fallback padrão da Agenda deveria ser 60 dias.');
if(normalizeAdminAgendaDays('x',30)!==30)throw new Error('Fallback customizado da Agenda falhou.');
console.log('Agenda window self-test: OK — 4 janelas válidas e entradas inválidas rejeitadas.');
