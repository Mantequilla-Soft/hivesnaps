import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchProfileFields, saveProfileFields } from '../services/ProfileService';
import { avatarService } from '../services/AvatarService';
import { useAppStore } from '../store/context';
import { pickImage, uploadPickedImage } from '../utils/pickImage';
import { EMPTY_PROFILE, profileFieldsError, type ProfileFields } from '../utils/profileMetadata';

export type ProfileImageKind = 'profile_image' | 'cover_image';

export interface UseEditProfileResult {
    fields: ProfileFields;
    loading: boolean;
    loadError: string | null;
    /** Which image is uploading, if any. */
    uploading: ProfileImageKind | null;
    saving: boolean;
    /** Something differs from what's on chain. */
    dirty: boolean;
    /** First validation problem with the current fields. */
    error: string | null;
    setField: (key: keyof ProfileFields, value: string) => void;
    /** Pick and upload a new avatar or cover. Rejects with a message on upload failure. */
    changeImage: (kind: ProfileImageKind) => Promise<void>;
    /** Broadcast the changes. Rejects with a message on failure. */
    save: () => Promise<void>;
    reload: () => Promise<void>;
}

/** State and actions for editing your own Hive profile. */
export function useEditProfile(username: string | null): UseEditProfileResult {
    const [initial, setInitial] = useState<ProfileFields>(EMPTY_PROFILE);
    const [fields, setFields] = useState<ProfileFields>(EMPTY_PROFILE);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [uploading, setUploading] = useState<ProfileImageKind | null>(null);
    const [saving, setSaving] = useState(false);
    const { setUserProfile, selectors } = useAppStore();
    const mountedRef = useRef(true);
    useEffect(() => () => { mountedRef.current = false; }, []);

    const reload = useCallback(async (): Promise<void> => {
        if (!username) return;
        setLoading(true);
        setLoadError(null);
        try {
            const current = await fetchProfileFields(username);
            if (!mountedRef.current) return;
            setInitial(current);
            setFields(current);
        } catch (err) {
            if (mountedRef.current) setLoadError(err instanceof Error ? err.message : 'Couldn’t load your profile.');
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, [username]);

    useEffect(() => {
        reload();
    }, [reload]);

    const setField = useCallback((key: keyof ProfileFields, value: string): void => {
        setFields((prev) => ({ ...prev, [key]: value }));
    }, []);

    const changeImage = useCallback(
        async (kind: ProfileImageKind): Promise<void> => {
            if (!username || uploading) return;
            const picked = await pickImage({
                title: kind === 'profile_image' ? 'Profile photo' : 'Cover image',
                square: kind === 'profile_image',
            });
            if (!picked) return;
            setUploading(kind);
            try {
                const url = await uploadPickedImage(picked, username);
                if (mountedRef.current) setFields((prev) => ({ ...prev, [kind]: url }));
            } catch (err) {
                throw new Error(err instanceof Error ? err.message : 'Upload failed.');
            } finally {
                if (mountedRef.current) setUploading(null);
            }
        },
        [username, uploading]
    );

    const save = useCallback(async (): Promise<void> => {
        if (!username || saving) return;
        setSaving(true);
        try {
            const saved = await saveProfileFields(username, fields);
            // The app's own avatar/name caches, so the change shows right away.
            if (saved.profile_image !== initial.profile_image) avatarService.clearCache();
            // setUserProfile replaces the cached entry, so keep what's there (reputation etc.).
            setUserProfile(username, {
                ...(selectors.getUserProfile(username) ?? {}),
                name: username,
                displayName: saved.name,
                about: saved.about,
                location: saved.location,
                website: saved.website,
                profile_image: saved.profile_image,
                cover_image: saved.cover_image,
                profile_image_last_updated: Date.now(),
            });
            if (mountedRef.current) {
                setInitial(saved);
                setFields(saved);
            }
        } finally {
            if (mountedRef.current) setSaving(false);
        }
    }, [username, saving, fields, initial.profile_image, setUserProfile, selectors]);

    const dirty = useMemo(
        () => (Object.keys(fields) as (keyof ProfileFields)[]).some((k) => fields[k] !== initial[k]),
        [fields, initial]
    );
    const error = useMemo(() => profileFieldsError(fields), [fields]);

    return { fields, loading, loadError, uploading, saving, dirty, error, setField, changeImage, save, reload };
}
