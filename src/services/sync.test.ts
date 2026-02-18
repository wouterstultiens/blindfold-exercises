import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSupabaseClient } = vi.hoisted(() => ({
  mockGetSupabaseClient: vi.fn()
}));

vi.mock("./supabase", () => ({
  getSupabaseClient: mockGetSupabaseClient
}));

import { deleteAllProgressEverywhere } from "./sync";

interface DeleteClient {
  from: ReturnType<typeof vi.fn>;
}

function createDeleteClient(attemptsError: { message: string } | null, sessionsError: { message: string } | null): DeleteClient {
  return {
    from: vi.fn((table: string) => {
      if (table === "attempts") {
        return {
          delete: () => ({
            eq: vi.fn().mockResolvedValue({ error: attemptsError })
          })
        };
      }
      if (table === "sessions") {
        return {
          delete: () => ({
            eq: vi.fn().mockResolvedValue({ error: sessionsError })
          })
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    })
  };
}

describe("deleteAllProgressEverywhere", () => {
  beforeEach(() => {
    mockGetSupabaseClient.mockReset();
  });

  it("returns local-only result when supabase is missing", async () => {
    mockGetSupabaseClient.mockReturnValue(null);

    const result = await deleteAllProgressEverywhere("user-123");

    expect(result.deletedRemote).toBe(false);
    expect(result.message).toContain("Cleared local data only");
  });

  it("returns local-only result for guest users", async () => {
    mockGetSupabaseClient.mockReturnValue(createDeleteClient(null, null));

    const result = await deleteAllProgressEverywhere("guest-local");

    expect(result.deletedRemote).toBe(false);
    expect(result.message).toContain("Guest profile");
  });

  it("deletes attempts and sessions for signed-in users", async () => {
    const client = createDeleteClient(null, null);
    mockGetSupabaseClient.mockReturnValue(client);

    const result = await deleteAllProgressEverywhere("user-123");

    expect(result.deletedRemote).toBe(true);
    expect(client.from).toHaveBeenCalledWith("attempts");
    expect(client.from).toHaveBeenCalledWith("sessions");
  });

  it("returns failure when cloud deletion errors", async () => {
    mockGetSupabaseClient.mockReturnValue(createDeleteClient({ message: "boom" }, null));

    const result = await deleteAllProgressEverywhere("user-123");

    expect(result.deletedRemote).toBe(false);
    expect(result.message).toContain("Failed to delete cloud attempts");
  });
});
