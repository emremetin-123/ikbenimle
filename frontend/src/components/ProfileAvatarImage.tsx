import { useState } from 'react';
import { getPhotoUrl } from '../config';

type ProfileAvatarImageProps = {
    photoPath?: string | null;
    seed?: string | number | null;
    alt: string;
    className?: string;
    thumbnailSize?: 160 | 320;
    loading?: 'eager' | 'lazy';
};

export const ProfileAvatarImage = ({ photoPath, alt, className, thumbnailSize, loading }: ProfileAvatarImageProps) => {
    const [failedSrc, setFailedSrc] = useState<string | null>(null);
    let src = getPhotoUrl(photoPath);
    if (thumbnailSize && photoPath?.startsWith('/uploads/avatars/')) {
        src += `${src.includes('?') ? '&' : '?'}avatarSize=${thumbnailSize}`;
    }

    if (!src || failedSrc === src) {
        return (
            <span
                className={`${className ? `${className} ` : ''}profile-avatar-fallback`}
                aria-label={alt}
                role="img"
            >
                <svg
                    width="58%"
                    height="58%"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                    focusable="false"
                >
                    <path
                        d="M20 21a8 8 0 0 0-16 0"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                    <circle
                        cx="12"
                        cy="7"
                        r="4"
                        stroke="currentColor"
                        strokeWidth="2"
                    />
                </svg>
            </span>
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            className={className}
            loading={loading}
            decoding="async"
            onError={() => setFailedSrc(src)}
        />
    );
};
