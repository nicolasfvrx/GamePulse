export interface CFToolsSettings {
  application_id: string;
  secret?: string;
  secret_preview?: string;
  is_configured: boolean;
}

export interface UpdateCFToolsSettingsInput {
  application_id: string;
  secret?: string;
}
