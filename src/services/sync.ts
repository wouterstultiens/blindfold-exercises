import type { AttemptRecord, ProgressSnapshot, SessionRecord, UserProfile } from "../types";
import { getSupabaseClient } from "./supabase";

export interface SyncPayload {
  attempts: AttemptRecord[];
  sessions: SessionRecord[];
  snapshots: ProgressSnapshot[];
  profile: UserProfile;
}

export async function syncLocalProgress(payload: SyncPayload): Promise<{ synced: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { synced: false, message: "Supabase config missing, running local-only mode." };
  }
  const userId = payload.profile.user_id;
  if (userId.startsWith("guest-")) {
    return { synced: false, message: "Guest profile cannot sync. Sign in with GitHub first." };
  }

  const unsyncedAttempts = payload.attempts.filter((attempt) => !attempt.synced);
  const unsyncedSessions = payload.sessions.filter((session) => !session.synced);
  const unsyncedSnapshots = payload.snapshots.filter((snapshot) => !snapshot.synced);

  if (unsyncedAttempts.length > 0) {
    const { error } = await client.from("attempts").insert(unsyncedAttempts);
    if (error) {
      return { synced: false, message: `Failed to sync attempts: ${error.message}` };
    }
  }

  if (unsyncedSessions.length > 0) {
    const { error } = await client.from("sessions").upsert(unsyncedSessions, {
      onConflict: "id"
    });
    if (error) {
      return { synced: false, message: `Failed to sync sessions: ${error.message}` };
    }
  }

  if (unsyncedSnapshots.length > 0) {
    const { error } = await client.from("progress_snapshots").upsert(unsyncedSnapshots, {
      onConflict: "user_id,stage"
    });
    if (error) {
      return { synced: false, message: `Failed to sync snapshots: ${error.message}` };
    }
  }

  const { error: profileError } = await client.from("profiles").upsert(payload.profile, {
    onConflict: "user_id"
  });
  if (profileError) {
    return { synced: false, message: `Failed to sync profile: ${profileError.message}` };
  }

  return { synced: true, message: "Synced successfully." };
}
