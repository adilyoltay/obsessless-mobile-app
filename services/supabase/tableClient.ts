import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Generic TableClient<T>: light wrapper around Supabase client
 * Provides a typed entry point for common CRUD chains.
 */
export class TableClient<T extends Record<string, any>> {
  constructor(private client: SupabaseClient, private table: string) {}

  from() {
    return this.client.from(this.table);
  }

  select(columns: string = '*') {
    return this.client.from(this.table).select(columns);
  }

  insert(row: Partial<T>) {
    return this.client.from(this.table).insert(row as any);
  }

  upsert(row: Partial<T>, options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    return this.client.from(this.table).upsert(row as any, options as any);
  }

  update(values: Partial<T>) {
    return this.client.from(this.table).update(values as any);
  }

  delete() {
    return this.client.from(this.table).delete();
  }
}

