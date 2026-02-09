'use client';

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { use } from "react";
import { submitFamousPersonRating, getFamousPersonStats, hasUserRatedFamousPerson, getUserFamousPersonRating, FamousPerson } from "@/lib/firestore";
import { getScoreLegend } from "@/lib/rating-scale";
import { Nav } from "@/components/Nav";
import { ShareableCardFamous } from "@/components/ShareableCard";
import html2canvas from "html2canvas";

interface RateFamousPageProps {
  params: Promise<{
    id: string;
  }>;
}

interface TMDBPerson {
  id: number;
  name: string;
  known_for_department: string;
  profile_path: string | null;
  popularity: number;
}

// Questions for famous people
const famousPersonQuestions = [
  { id: 'talent', question: 'Talent', description: 'Their natural skill and ability in their craft—acting, music, sports, or other creative work.' },
  { id: 'achievement', question: 'Achievement', description: "What they've accomplished in their career. Awards, milestones, and recognition." },
  { id: 'charisma', question: 'Charisma', description: 'Their magnetic personality and ability to captivate and inspire others.' },
  { id: 'reputation', question: 'Reputation', description: "How they're perceived publicly—their conduct, integrity, and influence." },
  { id: 'impact', question: 'Impact', description: "The lasting effect they've had on their field, culture, or society." },
];

const POINTS_PER_PERSON = 10000;

export default function RateFamousPage({ params }: RateFamousPageProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { id } = use(params);
  const searchParams = useSearchParams();
  const [famousPerson, setFamousPerson] = useState<FamousPerson | null>(null);
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [myRating, setMyRating] = useState<{ points: number; questionScores?: { [key: string]: number } } | null>(null);
  const [rankFromUrl, setRankFromUrl] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ratings, setRatings] = useState<{[key: string]: number}>({});
  const [flash, setFlash] = useState<{ questionId: string; label: string; id: number } | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [imageError, setImageError] = useState(false);
  const [openTooltipId, setOpenTooltipId] = useState<string | null>(null);
  const [copyLinkFeedback, setCopyLinkFeedback] = useState(false);
  const [capturingCard, setCapturingCard] = useState(false);
  const shareableCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      const target = e.target as HTMLElement;
      if (!target.closest('[data-tooltip-trigger]') && !target.closest('[data-tooltip-content]')) {
        setOpenTooltipId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setImageError(false);
  }, [famousPerson?.id]);

  const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || 'demo_key';
  const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
  const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w200';

  useEffect(() => {
    if (!loading && !user) {
      router.push(`/login?redirect=${encodeURIComponent(`/rate-famous/${id}`)}`);
      return;
    }
    if (user && id) {
      loadFamousPerson();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadFamousPerson runs on auth/id change
  }, [user, loading, id, router, searchParams]);

  const loadFamousPerson = async () => {
    if (!user) return;
    const rankParam = searchParams.get('rank');
    if (rankParam) {
      const r = parseInt(rankParam, 10);
      if (!Number.isNaN(r) && r > 0) setRankFromUrl(r);
    }
    try {
      const response = await fetch(`${TMDB_BASE_URL}/person/${id}?api_key=${TMDB_API_KEY}&language=en-US`);
      if (!response.ok) throw new Error('Failed to fetch from TMDB API');
      const personData: TMDBPerson = await response.json();
      const stats = await getFamousPersonStats(id);
      const rated = await hasUserRatedFamousPerson(user.uid, id);
      setAlreadyRated(rated);
      if (rated) {
        const my = await getUserFamousPersonRating(user.uid, id);
        setMyRating(my);
      } else {
        setMyRating(null);
      }
      setFamousPerson({
        id: personData.id.toString(),
        name: personData.name,
        profession: personData.known_for_department || 'Actor',
        imageUrl: personData.profile_path ? `${TMDB_IMAGE_BASE_URL}${personData.profile_path}` : '',
        totalAura: stats.totalAura,
        ratingsReceived: stats.ratingsReceived,
        averageRating: stats.averageRating
      });
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading famous person:', err);
      }
      setError('Failed to load famous person data. Please check if the ID is valid.');
    } finally {
      setIsLoading(false);
    }
  };

  const getTotalRating = () => {
    return famousPersonQuestions.reduce((total, q) => total + (ratings[q.id] ?? 0), 0);
  };

  const MAX_PER_QUESTION = 2000;

  const handleAdd500 = (questionId: string) => {
    const val = ratings[questionId] ?? 0;
    const newVal = Math.min(val + 500, MAX_PER_QUESTION);
    if (newVal !== val) {
      setRatings(prev => ({ ...prev, [questionId]: newVal }));
      setFlash({ questionId, label: '+500', id: Date.now() });
      setTimeout(() => setFlash(null), 600);
    }
  };

  const handleRemove500 = (questionId: string) => {
    const val = ratings[questionId] ?? 0;
    const newVal = Math.max(val - 500, -MAX_PER_QUESTION);
    if (newVal !== val) {
      setRatings(prev => ({ ...prev, [questionId]: newVal }));
      setFlash({ questionId, label: '-500', id: Date.now() });
      setTimeout(() => setFlash(null), 600);
    }
  };

  const handleSubmit = async () => {
    if (!user || !famousPerson) return;
    const totalPoints = getTotalRating();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      // Each person gets up to 10,000 points (±10,000). No global pool.
      const questionScores: { [key: string]: number } = {};
      famousPersonQuestions.forEach((q) => {
        const v = ratings[q.id] ?? 0;
        if (v !== 0) questionScores[q.id] = v;
      });
      await submitFamousPersonRating(
        user,
        famousPerson.id,
        famousPerson.name,
        totalPoints,
        undefined,
        Object.keys(questionScores).length > 0 ? questionScores : undefined
      );
      setSuccess('Appreciation shared!');
      setTimeout(() => router.push(`/rate-famous/${id}`), 1500);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Rating submission error:', err);
      }
      setError(err instanceof Error ? err.message : 'Failed to submit rating');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <span className="text-gray-500 dark:text-gray-400">Loading...</span>
      </div>
    );
  }

  if (!user) return null;

  if (error || !famousPerson) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        <Nav showBack backHref="/leaderboard" />
        <main className="max-w-md mx-auto px-4 py-12 text-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Famous Person Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">{error || 'The famous person you are looking for does not exist.'}</p>
          <Link href="/leaderboard" className="inline-block px-4 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-md hover:opacity-90">
            Top auras
          </Link>
        </main>
      </div>
    );
  }

  const totalGiven = getTotalRating();
  const barPosition = Math.max(0, Math.min(100, ((totalGiven + POINTS_PER_PERSON) / (POINTS_PER_PERSON * 2)) * 100));
  const isPositive = totalGiven >= 0;
  const fillWidth = Math.abs(barPosition - 50);

  if (alreadyRated && famousPerson) {
    const voteUrl = typeof window !== 'undefined' ? `${window.location.origin}/rate-famous/${id}` : '';
    const rank = rankFromUrl ?? 0;
    const handleCopyLink = async () => {
      try {
        await navigator.clipboard.writeText(voteUrl);
        setCopyLinkFeedback(true);
        setTimeout(() => setCopyLinkFeedback(false), 2000);
      } catch {
        // ignore
      }
    };
    const handleDownloadCard = async () => {
      const el = shareableCardRef.current;
      if (!el) return;
      setCapturingCard(true);
      try {
        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#0d1b2a',
          logging: false,
        });
        canvas.toBlob((blob) => {
          if (!blob) {
            setCapturingCard(false);
            return;
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `aura-${famousPerson.name.replace(/\s/g, '-')}-vote.png`;
          a.click();
          URL.revokeObjectURL(url);
          setCapturingCard(false);
        }, 'image/png', 1);
      } catch {
        setCapturingCard(false);
      }
    };

    return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        <Nav showBack backHref="/leaderboard?tab=famous" />
        <main className="max-w-xl mx-auto px-5 py-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1 text-center">Already voted</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm text-center mb-6">
            You&apos;ve already rated {famousPerson.name}. Here&apos;s your vote and how to spread the word.
          </p>

          {/* Profile + rank + summary */}
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-5 mb-6">
            <div className="flex items-center gap-4 mb-4">
              {famousPerson.imageUrl && !imageError ? (
                <Image
                  src={famousPerson.imageUrl}
                  alt={famousPerson.name}
                  width={80}
                  height={80}
                  className="w-20 h-20 rounded-full object-cover flex-shrink-0"
                  unoptimized
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 text-2xl font-semibold text-gray-600 dark:text-gray-300">
                  {(famousPerson.name || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-left min-w-0 flex-1">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{famousPerson.name}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{famousPerson.profession}</p>
                {rank > 0 && (
                  <p className="text-amber-600 dark:text-amber-400 text-sm font-medium mt-1">#{rank} on leaderboard</p>
                )}
                <p className="text-gray-700 dark:text-gray-300 text-sm font-mono mt-1">
                  {famousPerson.totalAura.toLocaleString()} total aura
                </p>
              </div>
            </div>
            {myRating && (
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">How you voted</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  You gave them <span className="font-semibold text-gray-900 dark:text-gray-100">{myRating.points > 0 ? '+' : ''}{myRating.points.toLocaleString()}</span> aura
                  {myRating.questionScores && Object.keys(myRating.questionScores).length > 0 && (
                    <span className="block mt-2 text-gray-500 dark:text-gray-500">
                      {Object.entries(myRating.questionScores)
                        .map(([qId, val]) => {
                          const q = famousPersonQuestions.find((x) => x.id === qId);
                          const label = q?.question ?? qId;
                          return `${label}: ${val > 0 ? '+' : ''}${val}`;
                        })
                        .join(' · ')}
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Share link + Share card */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {copyLinkFeedback ? (
                <>
                  <span className="text-green-600 dark:text-green-400">Copied!</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  Share link to vote
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDownloadCard}
              disabled={capturingCard}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-600 dark:bg-amber-500 text-white font-medium text-sm hover:bg-amber-700 dark:hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {capturingCard ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating image...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Shareable card image
                </>
              )}
            </button>
          </div>

          {/* Single card: same as downloaded image */}
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-2">Preview — download with the button above</p>
          <div className="flex justify-center">
            <div ref={shareableCardRef}>
              <ShareableCardFamous
                name={famousPerson.name}
                imageUrl={famousPerson.imageUrl || ''}
                rank={rank > 0 ? rank : 99}
                totalAura={famousPerson.totalAura}
              />
            </div>
          </div>

          <div className="text-center mt-6">
            <Link
              href="/leaderboard?tab=famous"
              className="inline-block px-5 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-xl hover:opacity-90 text-[13px]"
            >
              Back to leaderboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Nav showBack backHref="/leaderboard" />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="relative text-center text-gray-900 dark:text-gray-100 mb-4">
          {/* Dropdown at top */}
          <div className="absolute right-0 top-0" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="More options"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 py-1 w-40 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg z-10">
                <Link
                  href="/leaderboard?tab=famous"
                  onClick={() => setDropdownOpen(false)}
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Profile
                </Link>
              </div>
            )}
          </div>
          <h1 className="text-xl font-bold">Share what you appreciate</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Give aura to this famous person</p>
        </div>

        {/* Person Info */}
        <div className="border border-gray-200 dark:border-gray-800 rounded-md p-4 mb-6">
          <div className="flex items-center gap-4 mb-4">
            {famousPerson.imageUrl && !imageError ? (
              <Image
                src={famousPerson.imageUrl}
                alt={famousPerson.name}
                width={64}
                height={64}
                className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                unoptimized
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 text-2xl font-semibold text-gray-600 dark:text-gray-300">
                {(famousPerson.name || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{famousPerson.name}</h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm">{famousPerson.profession}</p>
              <div className="mt-2">
                <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{famousPerson.totalAura.toLocaleString()}</span>
                <span className="text-gray-600 dark:text-gray-400 text-sm ml-2">Total Aura</span>
              </div>
            </div>
          </div>
        </div>

        {error && <p className="mb-4 text-red-600 dark:text-red-400 text-sm">{error}</p>}
        {success && <p className="mb-4 text-green-600 dark:text-green-400 text-sm">{success}</p>}

        {/* Question-based rating - match group page structure */}
        <div className="border border-gray-200 dark:border-gray-800 rounded-md p-4 mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1 text-center">{famousPerson.name}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center">
            {totalGiven > 0 ? '+' : ''}{totalGiven.toLocaleString()} given (±2,000 per question)
          </p>
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden mb-2 relative">
            <div className="absolute left-1/2 top-0 w-0.5 h-full bg-gray-400 dark:bg-gray-600 -translate-x-px z-10" />
            <div
              className="absolute top-0 h-full transition-all"
              style={{
                width: `${fillWidth}%`,
                left: isPositive ? '50%' : `${barPosition}%`,
                backgroundColor: isPositive ? 'rgb(34 197 94)' : 'rgb(239 68 68)',
                borderRadius: isPositive ? '0 9999px 9999px 0' : '9999px 0 0 9999px'
              }}
            />
          </div>

          {/* All 5 questions - +500 / -500 per section */}
          <div className="space-y-4">
            {famousPersonQuestions.map((q) => {
              const val = ratings[q.id] ?? 0;
              const legend = getScoreLegend(val);
              return (
                <div key={q.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-2 sm:gap-4 py-3 border-b border-gray-100 dark:border-gray-800/60 last:border-0">
                  <div className="relative flex-shrink-0 sm:w-28 text-center sm:text-left flex items-center justify-center sm:justify-start gap-1" data-tooltip-trigger>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{q.question}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setOpenTooltipId(openTooltipId === q.id ? null : q.id); }}
                      className="inline-flex items-center justify-center w-4 h-4 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-medium"
                      aria-label={`What does ${q.question} mean?`}
                    >
                      i
                    </button>
                    {openTooltipId === q.id && (
                      <div className="absolute left-0 sm:left-0 top-full mt-2 z-20 p-3 rounded-lg bg-gray-900 dark:bg-gray-800 text-gray-100 text-sm shadow-lg border border-gray-700 w-[calc(100vw-2rem)] sm:w-64 max-w-[280px]" data-tooltip-content>
                        {q.description}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center justify-center gap-2 relative">
                      <button
                        type="button"
                        onClick={() => handleRemove500(q.id)}
                        disabled={val <= -MAX_PER_QUESTION}
                        className="px-3 py-2 text-sm font-medium rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        −500
                      </button>
                      <span className={`min-w-[4rem] text-center text-sm font-semibold ${val >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {val > 0 ? '+' : ''}{val}
                      </span>
                      {flash?.questionId === q.id && (
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
                        onClick={() => handleAdd500(q.id)}
                        disabled={val >= MAX_PER_QUESTION}
                        className="px-3 py-2 text-sm font-medium rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        +500
                      </button>
                    </div>
                    <p className={`text-[11px] font-medium ${val < 0 ? 'text-rose-500 dark:text-rose-400' : val > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      {legend}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Submit - match group page */}
        <div className="flex flex-col items-center gap-2">
          {totalGiven === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You&apos;re submitting neutral (0) on all categories.
            </p>
          )}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="py-3 px-8 rounded-md bg-gray-900 dark:bg-gray-600 dark:border dark:border-gray-500/50 text-white dark:text-gray-100 font-semibold hover:opacity-90 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-gray-100 dark:border-gray-500 border-t-transparent rounded-full animate-spin" />
                Submitting...
              </span>
            ) : (
              'Submit'
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
