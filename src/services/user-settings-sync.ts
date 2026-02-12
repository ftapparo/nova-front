import { api } from "@/services/api";

const SYNCED_KEYS = [
  "door-custom-names",
  "nr.quick-access.v1",
  "nova-residence-theme",
] as const;

const META_KEY = "nr.user-settings.meta.v1";
const PUSH_DEBOUNCE_MS = 500;

type LocalMeta = {
  user: string;
  updatedAt: number;
};

let pushTimer: number | null = null;

const normalizeUser = (user: string): string => user.trim().toUpperCase();

const isRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const readMeta = (): LocalMeta | null => {
  try {
    const raw = window.localStorage.getItem(META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;
    const user = typeof parsed.user === "string" ? normalizeUser(parsed.user) : "";
    const updatedAt = typeof parsed.updatedAt === "number" && Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : 0;
    if (!user || updatedAt <= 0) return null;
    return { user, updatedAt: Math.trunc(updatedAt) };
  } catch {
    return null;
  }
};

const writeMeta = (meta: LocalMeta) => {
  window.localStorage.setItem(META_KEY, JSON.stringify(meta));
};

const getStoredItems = (): Record<string, string> => {
  const items: Record<string, string> = {};
  for (const key of SYNCED_KEYS) {
    const value = window.localStorage.getItem(key);
    if (value !== null) items[key] = value;
  }
  return items;
};

const applyStoredItems = (items: Record<string, string>) => {
  for (const key of SYNCED_KEYS) {
    const value = items[key];
    if (typeof value === "string") {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
    }
  }
};

const hasItems = (items: Record<string, string>): boolean => Object.keys(items).length > 0;

const pushNow = async (user: string, updatedAt = Date.now()) => {
  const normalizedUser = normalizeUser(user);
  if (!normalizedUser) return;

  const items = getStoredItems();
  writeMeta({ user: normalizedUser, updatedAt });

  try {
    const response = await api.userSettingsUpsert(normalizedUser, { updatedAt, items });
    writeMeta({ user: normalizedUser, updatedAt: response.updatedAt || updatedAt });
  } catch (error) {
    console.error("[UserSettingsSync] Falha ao enviar preferências:", error);
  }
};

export const queueUserSettingsPush = (user: string) => {
  if (typeof window === "undefined") return;

  const normalizedUser = normalizeUser(user);
  if (!normalizedUser) return;

  if (pushTimer !== null) {
    window.clearTimeout(pushTimer);
  }

  pushTimer = window.setTimeout(() => {
    pushTimer = null;
    void pushNow(normalizedUser, Date.now());
  }, PUSH_DEBOUNCE_MS);
};

export const syncUserSettingsOnLogin = async (user: string) => {
  if (typeof window === "undefined") return;

  const normalizedUser = normalizeUser(user);
  if (!normalizedUser) return;

  const localItems = getStoredItems();
  const localHasItems = hasItems(localItems);
  const localMeta = readMeta();
  const localUpdatedAt = localMeta?.user === normalizedUser ? localMeta.updatedAt : 0;

  try {
    const remote = await api.userSettingsGet(normalizedUser);
    const remoteHasItems = hasItems(remote.items);

    if (!remote.exists) {
      if (localHasItems) {
        await pushNow(normalizedUser, localUpdatedAt > 0 ? localUpdatedAt : Date.now());
      } else {
        writeMeta({ user: normalizedUser, updatedAt: 0 });
      }
      return;
    }

    if (!localHasItems && localUpdatedAt <= 0) {
      applyStoredItems(remote.items);
      writeMeta({ user: normalizedUser, updatedAt: remote.updatedAt });
      return;
    }

    if (localUpdatedAt <= 0 && localHasItems) {
      if (remoteHasItems) {
        applyStoredItems(remote.items);
        writeMeta({ user: normalizedUser, updatedAt: remote.updatedAt });
      } else {
        await pushNow(normalizedUser, Date.now());
      }
      return;
    }

    if (remote.updatedAt > localUpdatedAt) {
      applyStoredItems(remote.items);
      writeMeta({ user: normalizedUser, updatedAt: remote.updatedAt });
      return;
    }

    if (localUpdatedAt > remote.updatedAt) {
      await pushNow(normalizedUser, localUpdatedAt);
    }
  } catch (error) {
    console.error("[UserSettingsSync] Falha ao sincronizar preferências no login:", error);
  }
};
