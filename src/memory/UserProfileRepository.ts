import { Firestore } from '@google-cloud/firestore';
import { UserProfile } from '../domain/profile';

const firestore = new Firestore();
// Probamos en este orden
const CANDIDATE_COLLECTIONS = ['user', 'users', 'profiles'] as const;

function mapFromDoc(data: FirebaseFirestore.DocumentData, uid: string): UserProfile {
  const name =
    (data.display_name as string | undefined) ??
    (data.displayName as string | undefined) ??
    (data.name as string | undefined);

  const language =
    (data.language as string | undefined) ??
    (data.languga as string | undefined);

  return {
    userId: uid,
    name,
    language,
    email: data.email as string | undefined,
    photoUrl: (data.photo_url as string | undefined) ?? (data.photoUrl as string | undefined),
    title: data.userTitle as string | undefined,
    age: typeof data.age === 'number' ? data.age : undefined,
    pushNotifications: typeof data.receive_push_notifications === 'boolean'
      ? data.receive_push_notifications
      : undefined,
    updatedAt: Date.now(),
  };
}

export class UserProfileRepository {
  async get(userId: string): Promise<UserProfile> {
    const id = String(userId).trim();
    for (const col of CANDIDATE_COLLECTIONS) {
      const ref = firestore.collection(col).doc(id);
      const snap = await ref.get();
      if (snap.exists) {
        const prof = mapFromDoc(snap.data()!, id);
        return prof;
      }
    }
    console.warn(`[UserProfileRepository] No profile found for uid=${id} in ${CANDIDATE_COLLECTIONS.join(', ')}`);
    return { userId: id, updatedAt: Date.now() };
  }

  async setName(userId: string, name: string): Promise<UserProfile> {
    // Escribimos en la colección principal (elige una) y mantenemos compatibilidad de campos
    const ref = firestore.collection('user').doc(userId);
    await ref.set({ display_name: name, name }, { merge: true });
    return this.get(userId);
  }

  async setLanguage(userId: string, language: string): Promise<UserProfile> {
    const ref = firestore.collection('user').doc(userId);
    // Mantener ambos por compatibilidad
    await ref.set({ language, languga: language }, { merge: true });
    return this.get(userId);
  }
}
