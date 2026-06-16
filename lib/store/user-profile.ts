/**
 * User Profile Store
 *
 * Persists avatar, nickname & bio.
 * Syncs to server when authenticated, falls back to localStorage.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Predefined avatar options */
export const AVATAR_OPTIONS = [
  '/avatars/user.png',
  '/avatars/teacher-2.png',
  '/avatars/assist-2.png',
  '/avatars/clown-2.png',
  '/avatars/curious-2.png',
  '/avatars/note-taker-2.png',
  '/avatars/thinker-2.png',
] as const;

export interface UserProfileState {
  /** Local avatar path or data-URL (for custom uploads) */
  avatar: string;
  nickname: string;
  bio: string;
  /** Whether profile has been loaded from server */
  serverLoaded: boolean;
  setAvatar: (avatar: string) => void;
  setNickname: (nickname: string) => void;
  setBio: (bio: string) => void;
  /** Load profile from server API */
  fetchFromServer: () => Promise<void>;
  /** Sync a field to server */
  syncToServer: (data: { nickname?: string; bio?: string }) => Promise<void>;
  /** Upload avatar to server */
  uploadAvatar: (file: File) => Promise<string | null>;
}

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, { credentials: 'include', ...options });
  if (!res.ok) return null;
  const json = await res.json();
  return json.success ? json : null;
}

export const useUserProfileStore = create<UserProfileState>()(
  persist(
    (set, get) => ({
      avatar: AVATAR_OPTIONS[0],
      nickname: '',
      bio: '',
      serverLoaded: false,

      setAvatar: (avatar) => set({ avatar }),
      setNickname: (nickname) => {
        set({ nickname });
        // Sync to server in background
        get().syncToServer({ nickname });
      },
      setBio: (bio) => {
        set({ bio });
        get().syncToServer({ bio });
      },

      fetchFromServer: async () => {
        const data = await apiFetch('/api/user/profile');
        if (data?.user) {
          const { avatar, nickname, bio } = data.user;
          set({
            avatar: avatar || get().avatar,
            nickname: nickname || '',
            bio: bio || '',
            serverLoaded: true,
          });
        }
      },

      syncToServer: async (data) => {
        await apiFetch('/api/user/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      },

      uploadAvatar: async (file: File) => {
        const formData = new FormData();
        formData.append('avatar', file);

        const res = await fetch('/api/user/avatar', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        if (!res.ok) return null;
        const json = await res.json();
        if (json.success && json.avatarUrl) {
          set({ avatar: json.avatarUrl });
          return json.avatarUrl;
        }
        return null;
      },
    }),
    {
      name: 'user-profile-storage',
    },
  ),
);
