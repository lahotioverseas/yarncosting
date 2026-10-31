import {
  Lead,
  LeadStatus,
  CampaignTemplate,
  CallAttempt,
  EmailLog,
  CrmFields,
  LeadHistoryItem,
} from '../types';

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    step: 1,
    name: '1st Mail - Initial Sourcing Intro & Details Request',
    subject: 'Quality Cotton Yarns & Fabrics for [Company Name]',
    delayDays: 0,
    triggerCondition: 'Immediate when status is New Lead',
    bodyTemplate: `Hi [Lead Name],

I hope this email finds you well.

I am reaching out from Lahoti Overseas Limited, one of India's leading exporters of high-quality textile raw materials, cotton yarns, synthetic yarns, and fabrics. Since 1990, we have been partnering with global textile manufacturers to supply high quality yarns to greige knitted, woven, and denim fabrics.

Because you handle high-quality textile production, I wanted to see if we could help streamline your supply chain with our spinning and weaving capabilities.

To help us share the most relevant counts, fabric specifications, and competitive pricing for your market, could you please share a few quick details with us?

Contact Person Responsible Name: [Contact Person]
Direct Email ID: [Direct Email]
Phone No/ Whats App: [Phone / WhatsApp]
Yarn Counts / Fabric Items you buy: [Yarn Counts / Items]
Approximate Quantity (per month): [Quantity per month]
Required Destination Port (CNF): [Destination Port]

Alternatively, if you are not the person handling sourcing, I would truly appreciate it if you could point me toward the right contact.

Thank you for your time, and I look forward to the possibility of working together.

Best regards,
[Sender Name]
Lahoti Overseas Limited
Exports Division | Mumbai, India`,
  },
  {
    step: 2,
    name: '2nd Mail - 4-Day Follow-up & Value Proposition',
    subject: 'Re: Quality Cotton Yarns & Fabrics for [Company Name] / Reliable Global Supply',
    delayDays: 4,
    triggerCondition: 'If no reply/response in 4 days after 1st mail',
    bodyTemplate: `Hi [Prospect Name],

I know how busy things get, so I wanted to quickly surface this in your inbox.

I understand you likely have existing supply chains, but given our 25+ years of experience exporting premium Indian cotton yarns and fabrics globally, I am confident we can offer competitive pricing or better lead times for your production.

If you have a quick moment, could you let me know your required yarn counts/items and your preferred destination port? We'd be delighted to prepare an instant spot CNF quote for your evaluation.

Looking forward to connecting with your team.

Best regards,
[Sender Name]
Lahoti Overseas Limited
Exports Division | Mumbai, India`,
  },
  {
    step: 3,
    name: '3rd Mail - Streamlining Supply Chain & Direct Mill Pricing',
    subject: 'Streamlining your yarn supply chain / [Company Name]',
    delayDays: 4,
    triggerCondition: 'If no reply/response in 4 days after 2nd mail',
    bodyTemplate: `Hi [Prospect Name],

Following up on my previous messages regarding cotton yarn and fabric sourcing from Lahoti Overseas Limited.

We are currently supporting textile mills and garment manufacturers across 40+ countries with prompt container shipments of Ring Spun, Compact, Open End, and Melange yarns at direct mill pricing.

Would you be open for a quick 5-minute introductory call or WhatsApp chat this week to see if we can provide cost savings on your upcoming monthly requirements?

Looking forward to hearing from you.

Best regards,
[Sender Name]
Lahoti Overseas Limited
Exports Division | Mumbai, India`,
  },
];

// Inbound email reply parser: extracts key fields from structured template fills and natural language responses
export function parseInboundEmailReply(replyContent: string): {
  extractedFields: Partial<CrmFields>;
  confidenceScore: number;
  extractedCount: number;
  isAlternateContact: boolean;
} {
  const extracted: Partial<CrmFields> = {};
  const text = replyContent;

  // 1. Structured Template Line Extractors
  const contactNameMatch = text.match(
    /(?:Contact Person(?: Responsible)?(?: Name)?|Responsible Name|Contact Person)\s*[:=-]\s*([^\r\n]+)/i
  );
  if (contactNameMatch && contactNameMatch[1].trim() && !contactNameMatch[1].includes('[')) {
    extracted.contactPersonResponsible = contactNameMatch[1].trim();
  }

  const directEmailMatch = text.match(
    /(?:Direct Email ID|Email ID|Direct Email|Email)\s*[:=-]\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i
  );
  if (directEmailMatch && directEmailMatch[1].trim()) {
    extracted.directEmailId = directEmailMatch[1].trim();
  } else {
    // Fallback: search for any email address in the body
    const genericEmailMatch = text.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/i);
    if (genericEmailMatch && !genericEmailMatch[1].includes('lahoti') && !genericEmailMatch[1].includes('example.com')) {
      extracted.directEmailId = genericEmailMatch[1].trim();
    }
  }

  const phoneMatch = text.match(
    /(?:Phone No\/?\s*Whats\s*App|Phone No|Phone|Whats\s*App|Mobile|Cell)\s*[:=-]\s*([+0-9\s-]{7,20})/i
  );
  if (phoneMatch && phoneMatch[1].trim() && !phoneMatch[1].includes('[')) {
    extracted.phoneWhatsApp = phoneMatch[1].trim();
  } else {
    // Look for international phone patterns
    const intlPhoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4,6}/);
    if (intlPhoneMatch && intlPhoneMatch[0].replace(/\D/g, '').length >= 8) {
      extracted.phoneWhatsApp = intlPhoneMatch[0].trim();
    }
  }

  const yarnCountsMatch = text.match(
    /(?:Yarn Counts\s*\/?\s*Fabric Items(?: you buy)?|Yarn Counts?|Fabric Items?|Counts?)\s*[:=-]\s*([^\r\n]+)/i
  );
  if (yarnCountsMatch && yarnCountsMatch[1].trim() && !yarnCountsMatch[1].includes('[')) {
    extracted.yarnCountsFabricItems = yarnCountsMatch[1].trim();
  } else {
    // Look for common yarn counts (e.g. 20s, 30s, 40s combed, compact, carded)
    const countPatterns = text.match(/\b(\d{1,2}s?\s*(?:Carded|Combed|Compact|Open\s*End|OE|Melange|Weaving|Hosiery|Knitting)?(?:\s*Cotton)?)\b/gi);
    if (countPatterns && countPatterns.length > 0) {
      extracted.yarnCountsFabricItems = countPatterns.slice(0, 3).join(', ');
    }
  }

  const quantityMatch = text.match(
    /(?:Approximate Quantity\s*\(per month\)|Approximate Quantity|Monthly Quantity|Quantity\s*\(per month\)|Quantity)\s*[:=-]\s*([^\r\n]+)/i
  );
  if (quantityMatch && quantityMatch[1].trim() && !quantityMatch[1].includes('[')) {
    extracted.approximateQuantityPerMonth = quantityMatch[1].trim();
  } else {
    // Look for quantity patterns (e.g. 2 FCL, 40 MT, 5 containers, 50,000 kg)
    const qtyPatterns = text.match(/\b(\d+(?:\.\d+)?\s*(?:FCL|HC|Containers?|MT|Tons?|Kgs?|Bags?)(?:\s*(?:per\s*month|\/month))?)\b/i);
    if (qtyPatterns && qtyPatterns[1]) {
      extracted.approximateQuantityPerMonth = qtyPatterns[1].trim();
    }
  }

  const portMatch = text.match(
    /(?:Required Destination Port\s*\(CNF\)|Destination Port\s*\(CNF\)|Required Port|Destination Port|Port)\s*[:=-]\s*([^\r\n]+)/i
  );
  if (portMatch && portMatch[1].trim() && !portMatch[1].includes('[')) {
    extracted.destinationPortCnf = portMatch[1].trim();
  } else {
    // Look for major textile destination ports
    const portList = [
      'Chittagong', 'Chattogram', 'Dhaka', 'Mongla',
      'Cat Lai', 'Ho Chi Minh', 'Haiphong', 'Da Nang',
      'Mersin', 'Istanbul', 'Izmir', 'Gemlik',
      'Alexandria', 'Port Said', 'Damietta',
      'Santos', 'Paranagua', 'Itajai',
      'Leixoes', 'Lisbon', 'Porto',
      'Karachi', 'Port Qasim',
      'Colombo', 'Jakarta', 'Surabaya', 'Semarang',
      'Callao', 'Guayaquil', 'Manzanillo', 'Altamira',
      'Antwerp', 'Hamburg', 'Rotterdam', 'Valencia', 'Barcelona'
    ];
    for (const p of portList) {
      if (new RegExp(`\\b${p}\\b`, 'i').test(text)) {
        extracted.destinationPortCnf = p;
        break;
      }
    }
  }

  // Check if they pointed to an alternate sourcing contact
  let isAlternateContact = false;
  if (/point\s+(?:you|me)\s+to|speak\s+with|contact\s+person\s+is|reach\s+out\s+to|forwarded\s+to|sourcing\s+handled\s+by/i.test(text)) {
    isAlternateContact = true;
    extracted.sourcingReferralContact = text.slice(0, 300);
  }

  // Compute confidence score
  const fieldKeys: (keyof CrmFields)[] = [
    'contactPersonResponsible',
    'directEmailId',
    'phoneWhatsApp',
    'yarnCountsFabricItems',
    'approximateQuantityPerMonth',
    'destinationPortCnf',
  ];
  const count = fieldKeys.filter((k) => !!extracted[k]).length;
  const confidenceScore = Math.min(100, Math.round((count / 6) * 100));

  return {
    extractedFields: extracted,
    confidenceScore,
    extractedCount: count,
    isAlternateContact,
  };
}

// Render personalized template
export function renderEmailTemplate(
  template: CampaignTemplate,
  lead: Lead,
  senderName: string = 'Rajesh Lahoti'
): { subject: string; body: string } {
  let subject = template.subject
    .replace(/\[Company Name\]/g, lead.companyName || 'Your Company')
    .replace(/\[Lead Name\]/g, lead.leadName || 'Sourcing Team')
    .replace(/\[Prospect Name\]/g, lead.leadName || 'Sourcing Manager');

  let body = template.bodyTemplate
    .replace(/\[Lead Name\]/g, lead.leadName || 'Sourcing Team')
    .replace(/\[Prospect Name\]/g, lead.leadName || 'Sourcing Manager')
    .replace(/\[Company Name\]/g, lead.companyName || 'your esteemed company')
    .replace(/\[Sender Name\]/g, senderName)
    .replace(/\[Contact Person\]/g, lead.crmFields?.contactPersonResponsible || '')
    .replace(/\[Direct Email\]/g, lead.crmFields?.directEmailId || lead.initialEmail || '')
    .replace(/\[Phone \/ WhatsApp\]/g, lead.crmFields?.phoneWhatsApp || lead.initialPhone || '')
    .replace(/\[Yarn Counts \/ Items\]/g, lead.crmFields?.yarnCountsFabricItems || '')
    .replace(/\[Quantity per month\]/g, lead.crmFields?.approximateQuantityPerMonth || '')
    .replace(/\[Destination Port\]/g, lead.crmFields?.destinationPortCnf || '');

  return { subject, body };
}

// Helper to format ISO date offset by N days
export function addDaysToIso(isoString: string, days: number): string {
  const d = new Date(isoString);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// Initial Sample Leads for Demonstration & Immediate Testing
export const INITIAL_DEMO_LEADS: Lead[] = [
  {
    id: 'lead_dhaka_01',
    companyName: 'Apex Knits & Garments Ltd',
    leadName: 'Tanvir Ahmed',
    initialEmail: 't.ahmed@apexknits-bd.com',
    initialPhone: '+880 1711-884920',
    country: 'Bangladesh',
    status: 'new_lead',
    currentStep: 1,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
    lastActivityAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    nextActionDueAt: new Date().toISOString(), // Due now for Mail 1
    crmFields: {
      contactPersonResponsible: '',
      directEmailId: '',
      phoneWhatsApp: '',
      yarnCountsFabricItems: '',
      approximateQuantityPerMonth: '',
      destinationPortCnf: '',
      notes: 'Import sourcing inquiry received from Dhaka trade portal.',
    },
    emailLogs: [],
    callAttempts: [],
    history: [
      {
        id: 'hist_1',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        action: 'Lead Created',
        details: 'Imported from Dhaka Textile Directory with status New Lead.',
        actor: 'System Automation',
      },
    ],
    assignedTo: 'Rohit Sharma (Exports)',
    isDripActive: true,
  },
  {
    id: 'lead_vietnam_02',
    companyName: 'Phong Phu Textile Corp',
    leadName: 'Nguyen Van Minh',
    initialEmail: 'minh.nguyen@phongphutex.vn',
    initialPhone: '+84 90 384 1928',
    country: 'Vietnam',
    status: 'mail_1_sent',
    currentStep: 1,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days ago
    lastActivityAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    nextActionDueAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(), // 1 day overdue for Mail 2
    crmFields: {
      contactPersonResponsible: '',
      directEmailId: '',
      phoneWhatsApp: '',
      yarnCountsFabricItems: '',
      approximateQuantityPerMonth: '',
      destinationPortCnf: '',
      notes: 'Leading denim manufacturer in Ho Chi Minh City.',
    },
    emailLogs: [
      {
        id: 'email_log_vn_1',
        step: 1,
        subject: 'Quality Cotton Yarns & Fabrics for Phong Phu Textile Corp',
        body: 'Hi Nguyen Van Minh,\nI hope this email finds you well...\n[Full 1st Email Sent]',
        sentAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
        sender: 'Rajesh Lahoti (Exports)',
        recipient: 'minh.nguyen@phongphutex.vn',
        status: 'sent',
      },
    ],
    callAttempts: [],
    history: [
      {
        id: 'hist_2a',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
        action: 'Lead Created',
        details: 'Added as New Lead',
        actor: 'System',
      },
      {
        id: 'hist_2b',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
        action: '1st Mail Sent',
        details: 'Drip Email #1 sent. Information collection form included.',
        actor: 'Drip Workflow Bot',
      },
    ],
    assignedTo: 'Vikram Mehta (VP Sales)',
    isDripActive: true,
  },
  {
    id: 'lead_turkey_03',
    companyName: 'Sanko Holding Tekstil A.S.',
    leadName: 'Murat Yilmaz',
    initialEmail: 'm.yilmaz@sankotekstil.com.tr',
    initialPhone: '+90 342 211 5000',
    country: 'Turkey',
    status: 'info_received',
    currentStep: 1,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
    lastActivityAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    nextActionDueAt: null, // Drip halted because reply received
    crmFields: {
      contactPersonResponsible: 'Murat Yilmaz (Head of Yarn Sourcing)',
      directEmailId: 'm.yilmaz@sankotekstil.com.tr',
      phoneWhatsApp: '+90 532 984 2190',
      yarnCountsFabricItems: '30s Combed Compact Weaving, 40s Compact',
      approximateQuantityPerMonth: '3 x 40FT HC (75 MT)',
      destinationPortCnf: 'Mersin Port, Turkey',
      notes: 'Customer replied to 1st mail. Ready for spot CNF quotation.',
    },
    emailLogs: [
      {
        id: 'email_log_tr_1',
        step: 1,
        subject: 'Quality Cotton Yarns & Fabrics for Sanko Holding Tekstil A.S.',
        body: 'Hi Murat Yilmaz,\nI hope this email finds you well...',
        sentAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
        sender: 'Rajesh Lahoti (Exports)',
        recipient: 'm.yilmaz@sankotekstil.com.tr',
        status: 'replied',
        repliedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        replyText: `Hi Rajesh,

Thank you for reaching out. Here are the requested procurement details:
Contact Person Responsible Name: Murat Yilmaz (Head of Yarn Sourcing)
Direct Email ID: m.yilmaz@sankotekstil.com.tr
Phone No/ Whats App: +90 532 984 2190
Yarn Counts / Fabric Items you buy: 30s Combed Compact Weaving, 40s Compact
Approximate Quantity (per month): 3 x 40FT HC (75 MT)
Required Destination Port (CNF): Mersin Port, Turkey

Please send spot price per kg CNF Mersin for 100% Cotton 30s Compact.
Best regards,
Murat`,
        extractedFields: {
          contactPersonResponsible: 'Murat Yilmaz (Head of Yarn Sourcing)',
          directEmailId: 'm.yilmaz@sankotekstil.com.tr',
          phoneWhatsApp: '+90 532 984 2190',
          yarnCountsFabricItems: '30s Combed Compact Weaving, 40s Compact',
          approximateQuantityPerMonth: '3 x 40FT HC (75 MT)',
          destinationPortCnf: 'Mersin Port, Turkey',
        },
      },
    ],
    callAttempts: [],
    history: [
      {
        id: 'hist_3a',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
        action: '1st Mail Sent',
        details: 'Sent 1st email introducing Lahoti capabilities.',
        actor: 'Drip Workflow Bot',
      },
      {
        id: 'hist_3b',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        action: 'Reply Auto-Parsed & CRM Updated',
        details: 'Extracted 6 CRM fields: Contact, Phone, Counts (30s/40s Compact), Qty (75 MT), CNF Mersin. Status set to Information Received.',
        actor: 'AI/NLP Parser',
      },
    ],
    assignedTo: 'Amitabh Lahoti (Director)',
    isDripActive: false,
  },
  {
    id: 'lead_portugal_04',
    companyName: 'Somelos Tecidos S.A.',
    leadName: 'António Ferreira',
    initialEmail: 'antonio.ferreira@somelos.pt',
    initialPhone: '+351 253 470 100',
    country: 'Portugal',
    status: 'mail_3_sent',
    currentStep: 3,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(), // 12 days ago
    lastActivityAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
    nextActionDueAt: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(), // Due for Sales Phone Call
    crmFields: {
      contactPersonResponsible: '',
      directEmailId: '',
      phoneWhatsApp: '+351 253 470 100',
      yarnCountsFabricItems: '',
      approximateQuantityPerMonth: '',
      destinationPortCnf: 'Leixoes Port',
      notes: 'Premium shirting & weaving mill in Guimarães.',
    },
    emailLogs: [
      {
        id: 'email_pt_1',
        step: 1,
        subject: 'Quality Cotton Yarns & Fabrics for Somelos Tecidos S.A.',
        body: 'Hi António Ferreira,\n...',
        sentAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
        sender: 'Rajesh Lahoti',
        recipient: 'antonio.ferreira@somelos.pt',
        status: 'sent',
      },
      {
        id: 'email_pt_2',
        step: 2,
        subject: 'Re: Quality Cotton Yarns & Fabrics for Somelos Tecidos S.A. / Reliable Global Supply',
        body: 'Hi António,\nI know how busy things get...',
        sentAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
        sender: 'Rajesh Lahoti',
        recipient: 'antonio.ferreira@somelos.pt',
        status: 'sent',
      },
      {
        id: 'email_pt_3',
        step: 3,
        subject: 'Streamlining your yarn supply chain / Somelos Tecidos S.A.',
        body: 'Hi António,\nFollowing up on my previous messages...',
        sentAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
        sender: 'Rajesh Lahoti',
        recipient: 'antonio.ferreira@somelos.pt',
        status: 'sent',
      },
    ],
    callAttempts: [],
    history: [
      {
        id: 'hist_4a',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
        action: '1st Mail Sent',
        details: 'Initial email sent.',
        actor: 'System',
      },
      {
        id: 'hist_4b',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
        action: '2nd Mail Sent (4-day Trigger)',
        details: 'No response after 4 days. Follow-up email 2 sent.',
        actor: 'Drip Engine',
      },
      {
        id: 'hist_4c',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
        action: '3rd Mail Sent (4-day Trigger)',
        details: 'No response after another 4 days. Final value email 3 sent.',
        actor: 'Drip Engine',
      },
      {
        id: 'hist_4d',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(),
        action: 'Assigned to Sales Rep for Calling',
        details: '4 days elapsed after 3rd mail. Triggered Step 4: Phone call follow-up.',
        actor: 'Workflow Engine',
      },
    ],
    assignedTo: 'Rohit Sharma (Exports)',
    isDripActive: true,
  },
  {
    id: 'lead_brazil_05',
    companyName: 'Fiacao Sao Bento Ltda',
    leadName: 'Lucas Oliveira',
    initialEmail: 'lucas@fiacaosaobento.com.br',
    initialPhone: '+55 11 98765-4321',
    country: 'Brazil',
    status: 'not_reachable',
    currentStep: 4,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 18).toISOString(),
    lastActivityAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
    nextActionDueAt: null,
    crmFields: {
      contactPersonResponsible: 'Lucas Oliveira',
      directEmailId: 'lucas@fiacaosaobento.com.br',
      phoneWhatsApp: '+55 11 98765-4321',
      yarnCountsFabricItems: '',
      approximateQuantityPerMonth: '',
      destinationPortCnf: 'Santos Port',
      notes: 'No response to 3 emails. 2 phone call attempts went unanswered.',
    },
    emailLogs: [
      { id: 'em_br_1', step: 1, subject: 'Quality Cotton Yarns & Fabrics for Fiacao Sao Bento Ltda', body: '...', sentAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 18).toISOString(), sender: 'Rajesh Lahoti', recipient: 'lucas@fiacaosaobento.com.br', status: 'sent' },
      { id: 'em_br_2', step: 2, subject: 'Re: Quality Cotton Yarns & Fabrics / Reliable Supply', body: '...', sentAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(), sender: 'Rajesh Lahoti', recipient: 'lucas@fiacaosaobento.com.br', status: 'sent' },
      { id: 'em_br_3', step: 3, subject: 'Streamlining your yarn supply chain / Fiacao Sao Bento Ltda', body: '...', sentAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(), sender: 'Rajesh Lahoti', recipient: 'lucas@fiacaosaobento.com.br', status: 'sent' },
    ],
    callAttempts: [
      {
        id: 'call_br_1',
        attemptNumber: 1,
        attemptedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
        callerName: 'Rohit Sharma',
        outcome: 'no_answer',
        notes: 'Rang 6 times, went to Brazilian Portuguese automated voicemail.',
      },
      {
        id: 'call_br_2',
        attemptNumber: 2,
        attemptedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
        callerName: 'Rohit Sharma',
        outcome: 'switched_off',
        notes: 'Number switched off / network unreachable. 2nd failed attempt.',
      },
    ],
    history: [
      {
        id: 'hist_5a',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
        action: 'Phone Call Attempt 1 Logged (Unsuccessful)',
        details: 'Outcome: No Answer (Voicemail). Next attempt required.',
        actor: 'Rohit Sharma',
      },
      {
        id: 'hist_5b',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
        action: 'Phone Call Attempt 2 Logged (Unsuccessful)',
        details: 'Outcome: Switched Off. 2 failed attempts reached.',
        actor: 'Rohit Sharma',
      },
      {
        id: 'hist_5c',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
        action: 'Status Changed to Not Reachable',
        details: 'Automatic rule triggered: 2 consecutive failed phone calls after 3 unreplied drip emails. Drip halted.',
        actor: 'Workflow Engine Rule',
      },
    ],
    assignedTo: 'Rohit Sharma (Exports)',
    isDripActive: false,
  },
];

// Sample reply templates for fast one-click simulation & testing
export const SAMPLE_REPLY_SCENARIOS = [
  {
    title: '🇧🇩 Bangladesh Knitwear (Structured Format)',
    label: 'Apex Knits - 30s Combed Compact (50 MT)',
    text: `Hi Rajesh,

Thank you for contacting us. We are currently reviewing our yarn suppliers for the next quarter.

Contact Person Responsible Name: Engr. Faisal Kabir (Head of Sourcing)
Direct Email ID: f.kabir@apexknits-bd.com
Phone No/ Whats App: +880 1713-992810
Yarn Counts / Fabric Items you buy: 30s Combed Compact 100% Cotton for circular knitting
Approximate Quantity (per month): 2 x 40FT HC Container (Approx 48-50 MT)
Required Destination Port (CNF): Chittagong Port (CNF)

Please provide your best CNF Chittagong price validity for 7 days.

Best regards,
Faisal Kabir`,
  },
  {
    title: '🇻🇳 Vietnam Denim Mill (Natural Text Format)',
    label: 'Phong Phu - 20s Carded & 10s Ring Spun',
    text: `Hello Lahoti team,

I received your email regarding cotton yarn supply. I am Mr. Tran Duc from Phong Phu Denim sourcing department. You can contact me directly on WhatsApp at +84 987 654 321 or email tran.duc@phongphu.vn.

We regularly buy 20s Carded Weaving and 10s Ring Spun Cotton yarns for our denim looms. Our typical monthly volume is around 80 MT (about 3-4 containers). Our discharge port is Cat Lai Port, Ho Chi Minh City.

Looking forward to your quotation and technical specification sheet.

Regards,
Tran Duc`,
  },
  {
    title: '🇪🇬 Egypt Textile Mill (Partial Info + Alternate Contact)',
    label: 'Alexandria Cotton - Alternate Buyer Referral',
    text: `Dear Sir,

I am no longer handling the yarn imports. Please contact our Chief Procurement Officer Mr. Youssef Mansour at y.mansour@alexcots.com or WhatsApp +20 100 1234567.

Our factory requires 40s Compact Weaving yarn, approximately 40 MT monthly delivered to Alexandria Port.

Thank you,
Ahmed Riad`,
  },
  {
    title: '🇹🇷 Turkey Melange Buyer (Spot Quote Request)',
    label: 'Gaziantep Knits - 24s/30s Melange & Carded',
    text: `Good day,

We are interested in Indian cotton yarns.
Contact Person Responsible Name: Selin Demir
Direct Email ID: selin@gaziantepknits.com.tr
Phone No/ Whats App: +90 544 112 3344
Yarn Counts / Fabric Items you buy: 24s Carded Hosiery & 30s Combed Hosiery
Approximate Quantity (per month): 60 MT per month
Required Destination Port (CNF): Mersin Port (CNF)

Kindly send CIF Mersin and CNF Mersin rates with LC 60 days terms.

Regards,
Selin Demir`,
  },
];
