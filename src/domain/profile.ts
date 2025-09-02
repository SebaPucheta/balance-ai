export type LanguageCode = 'es' | 'en' | 'pt' | 'fr' | 'de' | string;

export interface UserProfile {
  userId: string;
  name?: string;
  language?: LanguageCode;
  email?: string;
  photoUrl?: string;
  title?: string;
  age?: number;
  pushNotifications?: boolean;
  updatedAt: number;
}
