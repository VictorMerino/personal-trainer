import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseProfileRepository } from './supabase-profile-repository';

function fakeClient(overrides: Record<string, unknown>): SupabaseClient {
  return { from: vi.fn(() => overrides), rpc: vi.fn() } as unknown as SupabaseClient;
}

describe('SupabaseProfileRepository', () => {
  describe('getProfile', () => {
    it('reports not-found when no row exists', async () => {
      const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const eq = vi.fn(() => ({ maybeSingle }));
      const repo = new SupabaseProfileRepository(fakeClient({ select: vi.fn(() => ({ eq })) }));

      const result = await repo.getProfile('user-1');

      expect(result).toEqual({ ok: false, error: { kind: 'not-found', message: expect.any(String) } });
    });

    it('maps a stored row to UserProfile', async () => {
      const row = { goal: 'strength', level: 'intermediate', default_equipment_context: 'gym' };
      const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
      const eq = vi.fn(() => ({ maybeSingle }));
      const repo = new SupabaseProfileRepository(fakeClient({ select: vi.fn(() => ({ eq })) }));

      const result = await repo.getProfile('user-1');

      expect(result).toEqual({
        ok: true,
        value: { goal: 'strength', level: 'intermediate', defaultEquipmentContext: 'gym' },
      });
    });
  });

  describe('upsertProfile', () => {
    it('upserts on user_id and returns the round-tripped profile', async () => {
      const row = { goal: 'hypertrophy', level: 'beginner', default_equipment_context: 'none' };
      const single = vi.fn().mockResolvedValue({ data: row, error: null });
      const select = vi.fn(() => ({ single }));
      const upsert = vi.fn(() => ({ select }));
      const repo = new SupabaseProfileRepository(fakeClient({ upsert }));

      const result = await repo.upsertProfile('user-1', { goal: 'hypertrophy', level: 'beginner', defaultEquipmentContext: 'none' });

      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'user-1', goal: 'hypertrophy', level: 'beginner', default_equipment_context: 'none' }),
        { onConflict: 'user_id' },
      );
      expect(result).toEqual({
        ok: true,
        value: { goal: 'hypertrophy', level: 'beginner', defaultEquipmentContext: 'none' },
      });
    });
  });

  describe('addLimitation', () => {
    it('calls the upsert_active_limitation RPC, not a plain insert', async () => {
      const row = { id: 'lim-1', zone: 'knee', severity: 'moderate', status: 'active' };
      const rpc = vi.fn().mockResolvedValue({ data: row, error: null });
      const repo = new SupabaseProfileRepository({ rpc } as unknown as SupabaseClient);

      const result = await repo.addLimitation('user-1', 'knee', 'moderate');

      expect(rpc).toHaveBeenCalledWith('upsert_active_limitation', {
        p_user_id: 'user-1',
        p_zone: 'knee',
        p_severity: 'moderate',
      });
      expect(result).toEqual({ ok: true, value: { id: 'lim-1', zone: 'knee', severity: 'moderate', isActive: true } });
    });
  });

  describe('setLimitationStatus', () => {
    it('sets resolved_at when resolving, scoped to the calling user', async () => {
      const row = { id: 'lim-1', zone: 'knee', severity: 'moderate', status: 'resolved' };
      const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
      const select = vi.fn(() => ({ maybeSingle }));
      const secondEq = vi.fn(() => ({ select }));
      const firstEq = vi.fn(() => ({ eq: secondEq }));
      const update = vi.fn(() => ({ eq: firstEq }));
      const repo = new SupabaseProfileRepository(fakeClient({ update }));

      const result = await repo.setLimitationStatus('user-1', 'lim-1', 'resolved');

      expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'resolved', resolved_at: expect.any(String) }));
      expect(firstEq).toHaveBeenCalledWith('id', 'lim-1');
      expect(secondEq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(result).toEqual({ ok: true, value: { id: 'lim-1', zone: 'knee', severity: 'moderate', isActive: false } });
    });

    it('reports not-found when the limitation is not the caller\'s', async () => {
      const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const select = vi.fn(() => ({ maybeSingle }));
      const secondEq = vi.fn(() => ({ select }));
      const firstEq = vi.fn(() => ({ eq: secondEq }));
      const update = vi.fn(() => ({ eq: firstEq }));
      const repo = new SupabaseProfileRepository(fakeClient({ update }));

      const result = await repo.setLimitationStatus('user-1', 'lim-1', 'active');

      expect(result).toEqual({ ok: false, error: { kind: 'not-found', message: expect.any(String) } });
    });
  });
});
