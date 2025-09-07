export function isUnsyncedLocalItem(item: any): boolean {
  if (item?.pendingSync === true) return true;
  if (item?.synced === true) return false;
  if (item?.id) return false; // server-cached items
  return true; // default: no id and not marked synced
}

