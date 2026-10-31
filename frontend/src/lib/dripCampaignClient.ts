import { Lead, CampaignTemplate, CrmFields } from '../types';

export interface LeadsApiResponse {
  success: boolean;
  leads: Lead[];
  templates: CampaignTemplate[];
  virtualOffsetDays: number;
  lastBatchRunAt: string;
}

export async function fetchLeadsAndCampaign(): Promise<LeadsApiResponse> {
  const res = await fetch('/api/leads');
  if (!res.ok) throw new Error('Failed to fetch leads');
  return res.json();
}

export async function createLeadApi(payload: {
  companyName: string;
  leadName: string;
  email: string;
  phone?: string;
  country?: string;
  notes?: string;
  assignedTo?: string;
  sendEmail1Immediately?: boolean;
}): Promise<{ success: boolean; lead: Lead; message: string }> {
  const res = await fetch('/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create lead');
  return res.json();
}

export async function updateLeadApi(leadId: string, updates: Partial<Lead>): Promise<{ success: boolean; lead: Lead }> {
  const res = await fetch(`/api/leads/${leadId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update lead');
  return res.json();
}

export async function deleteLeadApi(leadId: string): Promise<{ success: boolean }> {
  const res = await fetch(`/api/leads/${leadId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete lead');
  return res.json();
}

export async function sendNextEmailApi(leadId: string, senderName?: string): Promise<{ success: boolean; lead: Lead }> {
  const res = await fetch(`/api/leads/${leadId}/send-next-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senderName }),
  });
  if (!res.ok) throw new Error('Failed to send next email');
  return res.json();
}

export async function simulateReplyApi(
  leadId: string,
  replyText: string,
  customSender?: string
): Promise<{
  success: boolean;
  lead: Lead;
  extractedFields: Partial<CrmFields>;
  confidenceScore: number;
  message: string;
}> {
  const res = await fetch(`/api/leads/${leadId}/simulate-reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ replyText, customSender }),
  });
  if (!res.ok) throw new Error('Failed to simulate reply');
  return res.json();
}

export async function logCallAttemptApi(
  leadId: string,
  payload: {
    callerName: string;
    outcome: 'no_answer' | 'switched_off' | 'busy' | 'wrong_number' | 'connected' | 'call_back_requested';
    notes: string;
  }
): Promise<{ success: boolean; lead: Lead; message: string }> {
  const res = await fetch(`/api/leads/${leadId}/log-call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to log call');
  return res.json();
}

export async function fastForwardTimeApi(days: number = 4): Promise<{
  success: boolean;
  advancedDays: number;
  virtualOffsetDays: number;
  emailsSent: number;
  callsAssigned: number;
  leads: Lead[];
  message: string;
}> {
  const res = await fetch('/api/leads/fast-forward-time', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days }),
  });
  if (!res.ok) throw new Error('Failed to fast forward time');
  return res.json();
}

export async function processDripBatchApi(): Promise<{
  success: boolean;
  processedCount: number;
  emailsSent: number;
  callsAssigned: number;
  leads: Lead[];
  message: string;
}> {
  const res = await fetch('/api/leads/process-drip-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error('Failed to process drip batch');
  return res.json();
}

export async function resetDemoLeadsApi(): Promise<{ success: boolean; leads: Lead; message: string }> {
  const res = await fetch('/api/leads/reset-demo', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reset demo leads');
  return res.json();
}

export async function saveCampaignTemplatesApi(templates: CampaignTemplate[]): Promise<{ success: boolean }> {
  const res = await fetch('/api/drip-campaign/templates', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templates }),
  });
  if (!res.ok) throw new Error('Failed to save templates');
  return res.json();
}
