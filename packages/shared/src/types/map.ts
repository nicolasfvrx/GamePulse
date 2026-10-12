export interface MapDictionaryEntry {
  raw_name: string;
  display_name: string;
  created_at?: string;
  updated_at?: string;
}

export interface UpsertMapEntryInput {
  raw_name: string;
  display_name: string;
}
