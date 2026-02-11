'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Nav } from '@/components/Nav';
import {
  createFeedPost,
  getFeedPosts,
  getFeedAuraPointsByUser,
  uploadFeedImages,
  type FeedPost,
  FEED_CONTENT_MAX,
  FEED_IMAGES_MAX,
  FEED_AURA_STEP,
  FEED_AURA_MAX,
  FEED_AURA_MIN,
} from '@/lib/firestore';
import type { DocumentSnapshot } from 'firebase/firestore';

const FEED_IMAGE_MAX_DIM = 1200;
const FEED_IMAGE_JPEG_QUALITY = 0.85;

/** Resize image to max dimension and compress as JPEG for faster upload. */
async function resizeImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w <= FEED_IMAGE_MAX_DIM && h <= FEED_IMAGE_MAX_DIM && file.size < 400_000) {
        resolve(file);
        return;
      }
      const scale = Math.min(FEED_IMAGE_MAX_DIM / w, FEED_IMAGE_MAX_DIM / h, 1);
      const cw = Math.round(w * scale);
      const ch = Math.round(h * scale);
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, cw, ch);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/i, '.jpg'), { type: 'image/jpeg' }));
        },
        'image/jpeg',
        FEED_IMAGE_JPEG_QUALITY
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

/** Split text into segments; URLs become clickable links (https? only). */
function linkify(text: string): React.ReactNode {
  if (!text.trim()) return null;
  const urlRegex = /https?:\/\/[^\s]+/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const url = match[0];
    const href = url.replace(/[.)]+$/, ''); // trim trailing punctuation from URL
    parts.push(
      <a
        key={match.index}
        href={href.startsWith('http') ? href : `https://${href}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-amber-600 dark:text-amber-400 underline break-all"
      >
        {url}
      </a>
    );
    lastIndex = match.index + url.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}

export default function FeedPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [givenAuraPoints, setGivenAuraPoints] = useState<Map<string, number>>(new Map());
  const [content, setContent] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'uploading' | 'posting'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [givingAuraPostId, setGivingAuraPostId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ postId: string; label: string; id: number } | null>(null);
  const lastDocRef = useRef<DocumentSnapshot | null>(null);

  const loadFeed = useCallback(async (append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const { posts: nextPosts, lastDoc: nextLast } = await getFeedPosts(
        20,
        append ? lastDocRef.current ?? undefined : undefined
      );
      if (append) {
        setPosts((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          const newOnes = nextPosts.filter((p) => !ids.has(p.id));
          return [...prev, ...newOnes];
        });
      } else {
        setPosts(nextPosts);
      }
      lastDocRef.current = nextLast;
      setLastDoc(nextLast);
      setHasMore(nextPosts.length === 20);
      if (user) {
        const points = await getFeedAuraPointsByUser(user.uid);
        setGivenAuraPoints(points);
      }
    } catch (e) {
      setError('Failed to load feed');
      if (process.env.NODE_ENV === 'development') console.error(e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) loadFeed();
  }, [authLoading, loadFeed]);

  useEffect(() => {
    const urls = imagePreviewUrls;
    return () => {
      urls.forEach(URL.revokeObjectURL);
    };
  }, [imagePreviewUrls]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/')).slice(0, FEED_IMAGES_MAX);
    if (files.length === 0) return;
    setImageFiles(files);
    const urls = files.map((f) => URL.createObjectURL(f));
    setImagePreviewUrls((prev) => {
      prev.forEach(URL.revokeObjectURL);
      return urls;
    });
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    URL.revokeObjectURL(imagePreviewUrls[index] ?? '');
    setImagePreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || submitting) return;
    if (!content.trim() && imageFiles.length === 0) return;
    setSubmitting(true);
    setError(null);
    setUploadPhase('idle');
    try {
      let imageUrls: string[] = [];
      if (imageFiles.length > 0) {
        setUploadPhase('uploading');
        const resized = await Promise.all(imageFiles.map(resizeImageForUpload));
        imageUrls = await uploadFeedImages(user.uid, resized);
        imagePreviewUrls.forEach(URL.revokeObjectURL);
        setImageFiles([]);
        setImagePreviewUrls([]);
        setUploadPhase('posting');
      }
      await createFeedPost(user, content.trim(), imageUrls);
      setContent('');
      await loadFeed();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to post');
    } finally {
      setSubmitting(false);
      setUploadPhase('idle');
    }
  };

  const handleGiveAura = async (postId: string, delta: number) => {
    if (!user) return;
    setFlash({ postId, label: delta > 0 ? `+${delta}` : `${delta}`, id: Date.now() });
    setTimeout(() => setFlash(null), 600);
    setGivingAuraPostId(postId);
    setError(null);
    const prevPoints = givenAuraPoints.get(postId) ?? 0;
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/feed/aura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token, postId, delta }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Failed to update aura');
      }
      const data = (await res.json()) as { points: number };
      const newPoints = data.points;
      setGivenAuraPoints((prev) => new Map(prev).set(postId, newPoints));
      const increment = newPoints - prevPoints;
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, totalAuraCount: (p.totalAuraCount ?? 0) + increment }
            : p
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update aura');
    } finally {
      setGivingAuraPostId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <span className="text-gray-500 dark:text-gray-400">Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Nav showBack backHref={user ? '/dashboard' : '/leaderboard'} />

      <main className="max-w-xl mx-auto px-5 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Feed</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {user
              ? 'Share updates. Others can add aura to your post — it counts toward your profile.'
              : 'Browse updates. Sign in to post or add aura to posts.'}
          </p>
        </header>

        {/* Create post — only when signed in */}
        {user && (
        <form onSubmit={handleCreatePost} className="mb-8">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, FEED_CONTENT_MAX))}
            placeholder="What’s up? Share a win or something you’re proud of..."
            rows={3}
            maxLength={FEED_CONTENT_MAX}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 resize-none text-sm"
            disabled={submitting}
          />
          <div className="mt-2 flex flex-wrap gap-2 items-center">
            <label className="cursor-pointer px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
              Add images (max {FEED_IMAGES_MAX})
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={handleImageSelect}
              />
            </label>
            {imagePreviewUrls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {imagePreviewUrls.map((url, i) => (
                  <div key={url} className="relative">
                    <img
                      src={url}
                      alt={`Preview ${i + 1}`}
                      className="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600"
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">
              {content.length}/{FEED_CONTENT_MAX}
            </span>
            <button
              type="submit"
              disabled={submitting || (!content.trim() && imageFiles.length === 0)}
              className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50 disabled:pointer-events-none"
            >
              {submitting ? (uploadPhase === 'uploading' ? 'Uploading images…' : 'Posting…') : 'Post'}
            </button>
          </div>
        </form>
        )}

        {error && (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {/* Feed list — fair chronological order (newest first) */}
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading feed...</p>
        ) : posts.length === 0 ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
            No posts yet. Be the first to share something.
          </div>
        ) : (
          <ul className="space-y-4">
            {posts.map((post) => {
              const isOwn = user ? user.uid === post.authorId : false;
              const myPoints = givenAuraPoints.get(post.id) ?? 0;
              const canGiveAura = !!user && !isOwn;
              const giving = givingAuraPostId === post.id;
              const auraCount = post.totalAuraCount ?? 0;
              const canAdd = canGiveAura && myPoints < FEED_AURA_MAX && !giving;
              const canSubtract = canGiveAura && myPoints > FEED_AURA_MIN && !giving;
              const showSignInPrompt = !user && !isOwn;

              return (
                <li
                  key={post.id}
                  className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-4"
                >
                  <div className="flex gap-3">
                    <Link
                      href={`/profile/${post.authorId}`}
                      className="shrink-0 flex items-center gap-2"
                    >
                      {post.authorPhotoURL ? (
                        <Image
                          src={post.authorPhotoURL}
                          alt=""
                          width={40}
                          height={40}
                          className="w-10 h-10 rounded-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 dark:text-amber-400 font-semibold text-sm">
                          {(post.authorDisplayName || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/profile/${post.authorId}`}
                        className="font-medium text-gray-900 dark:text-gray-100 text-sm hover:underline"
                      >
                        {post.authorDisplayName || 'Someone'}
                      </Link>
                      {post.content?.trim() ? (
                        <p className="mt-1 text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap break-words">
                          {linkify(post.content)}
                        </p>
                      ) : null}
                      {post.imageUrls && post.imageUrls.length > 0 && (
                        <div
                          className={`mt-2 grid gap-1 ${
                            post.imageUrls.length === 1
                              ? 'grid-cols-1 max-w-xs'
                              : post.imageUrls.length === 2
                                ? 'grid-cols-2 max-w-sm'
                                : 'grid-cols-2 max-w-md'
                          }`}
                        >
                          {post.imageUrls.map((url, i) => (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
                            >
                              <img
                                src={url}
                                alt=""
                                className="w-full aspect-square object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                            <span className="text-amber-500">✦</span> {auraCount} aura
                          </span>
                        {showSignInPrompt && (
                          <Link
                            href="/leaderboard"
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          >
                            Sign in to add aura
                          </Link>
                        )}
                        {canGiveAura && (
                          <span className="flex items-center justify-center gap-2 relative">
                            {flash?.postId === post.id && (
                              <span
                                key={flash.id}
                                className={`absolute left-1/2 -translate-x-1/2 -top-1 text-sm font-bold animate-[fadeUpOut_0.6s_ease-out_forwards] pointer-events-none ${
                                  flash.label.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'
                                }`}
                              >
                                {flash.label}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleGiveAura(post.id, -FEED_AURA_STEP)}
                              disabled={!canSubtract}
                              className="px-3 py-2 text-sm font-medium rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              −{FEED_AURA_STEP}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleGiveAura(post.id, FEED_AURA_STEP)}
                              disabled={!canAdd}
                              className="px-3 py-2 text-sm font-medium rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {giving ? '…' : `+${FEED_AURA_STEP}`}
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {hasMore && posts.length > 0 && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => loadFeed(true)}
              disabled={loadingMore}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-50"
            >
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
