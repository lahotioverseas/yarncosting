import { ZohoAccountItem } from '../types';

export const FALLBACK_ZOHO_ACCOUNTS: ZohoAccountItem[] = [
  // Aadhitiya Lahoti's Owned Customers & Agents
  { id: 'acc_a1', name: 'Apex Textile Mills Ltd', type: 'Account', owner_name: 'Aadhitiya Lahoti', owner_email: 'aadhitiya@lahotioverseas.com' },
  { id: 'acc_a2', name: 'Chittagong Composite Weaving', type: 'Account', owner_name: 'Aadhitiya Lahoti', owner_email: 'aadhitiya@lahotioverseas.com' },
  { id: 'acc_a3', name: 'Cairo Spinning & Weaving', type: 'Account', owner_name: 'Aadhitiya Lahoti', owner_email: 'aadhitiya@lahotioverseas.com' },
  { id: 'ag_a1', name: 'Bengal Cotton Imports', type: 'Agent', owner_name: 'Aadhitiya Lahoti', owner_email: 'aadhitiya@lahotioverseas.com' },
  { id: 'ag_a2', name: 'Delta Agency Chittagong', type: 'Agent', owner_name: 'Aadhitiya Lahoti', owner_email: 'aadhitiya@lahotioverseas.com' },

  // Saurabh Lahoti's Owned Customers & Agents
  { id: 'acc_s1', name: 'Sokhna Spinners Ltd', type: 'Account', owner_name: 'Saurabh Lahoti', owner_email: 'saurabh@lahotioverseas.com' },
  { id: 'acc_s2', name: 'Alexandria Yarn Traders', type: 'Account', owner_name: 'Saurabh Lahoti', owner_email: 'saurabh@lahotioverseas.com' },
  { id: 'acc_s3', name: 'Global Denim Mills', type: 'Account', owner_name: 'Saurabh Lahoti', owner_email: 'saurabh@lahotioverseas.com' },
  { id: 'ag_s1', name: 'Rahman & Sons Textiles', type: 'Agent', owner_name: 'Saurabh Lahoti', owner_email: 'saurabh@lahotioverseas.com' },
  { id: 'ag_s2', name: 'Mediterranean Yarn Brokers', type: 'Agent', owner_name: 'Saurabh Lahoti', owner_email: 'saurabh@lahotioverseas.com' },

  // Javier Moreano's Owned Customers & Agents
  { id: 'acc_j1', name: 'Latin America Textiles S.A.', type: 'Account', owner_name: 'Javier Moreano', owner_email: 'javier@lahotioverseas.com' },
  { id: 'acc_j2', name: 'Bogota Knitting Mills', type: 'Account', owner_name: 'Javier Moreano', owner_email: 'javier@lahotioverseas.com' },
  { id: 'acc_j3', name: 'Medellin Cotton Co.', type: 'Account', owner_name: 'Javier Moreano', owner_email: 'javier@lahotioverseas.com' },
  { id: 'ag_j1', name: 'Andes Yarn Brokers', type: 'Agent', owner_name: 'Javier Moreano', owner_email: 'javier@lahotioverseas.com' },
  { id: 'ag_j2', name: 'Moreano & Partners Agency', type: 'Agent', owner_name: 'Javier Moreano', owner_email: 'javier@lahotioverseas.com' },

  // Mehadi Hasan's Owned Customers & Agents
  { id: 'acc_m1', name: 'Dhaka Knitting & Dyeing Ltd', type: 'Account', owner_name: 'Mehadi Hasan', owner_email: 'mehadi@lahotioverseas.com' },
  { id: 'acc_m2', name: 'Narayanganj Spinners Corp', type: 'Account', owner_name: 'Mehadi Hasan', owner_email: 'mehadi@lahotioverseas.com' },
  { id: 'acc_m3', name: 'Padma Textiles Limited', type: 'Account', owner_name: 'Mehadi Hasan', owner_email: 'mehadi@lahotioverseas.com' },
  { id: 'ag_m1', name: 'Hasan Yarn Associates', type: 'Agent', owner_name: 'Mehadi Hasan', owner_email: 'mehadi@lahotioverseas.com' },
  { id: 'ag_m2', name: 'Bengal Trade Linkers', type: 'Agent', owner_name: 'Mehadi Hasan', owner_email: 'mehadi@lahotioverseas.com' },

  // Rashmi Shishivkar's Owned Customers & Agents
  { id: 'acc_r1', name: 'EuroTex Spinning GmbH', type: 'Account', owner_name: 'Rashmi Shishivkar', owner_email: 'rashmi@lahotioverseas.com' },
  { id: 'acc_r2', name: 'Porto Cotton Importers', type: 'Account', owner_name: 'Rashmi Shishivkar', owner_email: 'rashmi@lahotioverseas.com' },
  { id: 'acc_r3', name: 'Milan Weaving SpA', type: 'Account', owner_name: 'Rashmi Shishivkar', owner_email: 'rashmi@lahotioverseas.com' },
  { id: 'ag_r1', name: 'Continental Yarn Agents', type: 'Agent', owner_name: 'Rashmi Shishivkar', owner_email: 'rashmi@lahotioverseas.com' },
  { id: 'ag_r2', name: 'Shishivkar Logistics Agency', type: 'Agent', owner_name: 'Rashmi Shishivkar', owner_email: 'rashmi@lahotioverseas.com' },

  // Tusshar Manekarr's Owned Customers & Agents
  { id: 'acc_t1', name: 'Vietnam Cotton Corp', type: 'Account', owner_name: 'Tusshar Manekarr', owner_email: 'tusshar@lahotioverseas.com' },
  { id: 'acc_t2', name: 'Hanoi Textile Mills', type: 'Account', owner_name: 'Tusshar Manekarr', owner_email: 'tusshar@lahotioverseas.com' },
  { id: 'acc_t3', name: 'Saigon Hosiery Ltd', type: 'Account', owner_name: 'Tusshar Manekarr', owner_email: 'tusshar@lahotioverseas.com' },
  { id: 'ag_t1', name: 'Mekong Yarn Agency', type: 'Agent', owner_name: 'Tusshar Manekarr', owner_email: 'tusshar@lahotioverseas.com' },
  { id: 'ag_t2', name: 'Manekarr Asian Trade Link', type: 'Agent', owner_name: 'Tusshar Manekarr', owner_email: 'tusshar@lahotioverseas.com' },

  // Avinash's Owned Customers & Agents
  { id: 'acc_av1', name: 'Mundra Export Fabrics', type: 'Account', owner_name: 'Avinash', owner_email: 'avinash@lahotioverseas.com' },
  { id: 'acc_av2', name: 'Gujarat Cotton Guild', type: 'Account', owner_name: 'Avinash', owner_email: 'avinash@lahotioverseas.com' },
  { id: 'acc_av3', name: 'Ahmedabad Weaving Ltd', type: 'Account', owner_name: 'Avinash', owner_email: 'avinash@lahotioverseas.com' },
  { id: 'ag_av1', name: 'Western India Yarn Brokers', type: 'Agent', owner_name: 'Avinash', owner_email: 'avinash@lahotioverseas.com' },
  { id: 'ag_av2', name: 'Avinash Trade Linkers', type: 'Agent', owner_name: 'Avinash', owner_email: 'avinash@lahotioverseas.com' },

  // Mahnaz Kausar Kausar's Owned Customers & Agents
  { id: 'acc_mk1', name: 'Gulf Cotton Importers FZE', type: 'Account', owner_name: 'Mahnaz Kausar Kausar', owner_email: 'mahnaz@lahotioverseas.com' },
  { id: 'acc_mk2', name: 'Dubai Textile Traders LLC', type: 'Account', owner_name: 'Mahnaz Kausar Kausar', owner_email: 'mahnaz@lahotioverseas.com' },
  { id: 'acc_mk3', name: 'Riyadh Knitting Mills', type: 'Account', owner_name: 'Mahnaz Kausar Kausar', owner_email: 'mahnaz@lahotioverseas.com' },
  { id: 'ag_mk1', name: 'Arabian Yarn Agency', type: 'Agent', owner_name: 'Mahnaz Kausar Kausar', owner_email: 'mahnaz@lahotioverseas.com' },
  { id: 'ag_mk2', name: 'Kausar Global Agency', type: 'Agent', owner_name: 'Mahnaz Kausar Kausar', owner_email: 'mahnaz@lahotioverseas.com' },
];
