import { buildUsersUpsertRow } from '@/utils/userRowMapper';

describe('Signup → users row mapping', () => {
  test('buildUsersUpsertRow maps auth user to users table row', () => {
    const authUser: any = {
      id: 'user-xyz',
      email: 'new.user@test.dev',
      user_metadata: { name: 'New User' },
      app_metadata: { provider: 'email' },
    };

    const row = buildUsersUpsertRow(authUser);
    expect(row).toMatchObject({
      id: 'user-xyz',
      email: 'new.user@test.dev',
      name: 'New User',
      provider: 'email',
    });
    expect(typeof row.created_at).toBe('string');
    expect(typeof row.updated_at).toBe('string');
  });

  test('falls back to email prefix when name missing', () => {
    const authUser: any = {
      id: 'user-abc',
      email: 'someone@example.com',
      user_metadata: {},
      app_metadata: {},
    };
    const row = buildUsersUpsertRow(authUser);
    expect(row.name).toBe('someone');
    expect(row.provider).toBe('email');
  });
});

