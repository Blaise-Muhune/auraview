'use client';

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { use } from "react";
import { submitFamousPersonRating, getFamousPersonStats, hasUserRatedFamousPerson, FamousPerson } from "@/lib/firestore";
import { getScoreLegend } from "@/lib/rating-scale";
import { Nav } from "@/components/Nav";

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
  { id: 'talent', question: 'Talent' },
  { id: 'achievement', question: 'Achievement' },
  { id: 'charisma', question: 'Charisma' },
  { id: 'style', question: 'Style' },
  { id: 'impact', question: 'Impact' },
];

const POINTS_PER_PERSON = 10000;

export default function RateFamousPage({ params }: RateFamousPageProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { id } = use(params);
  const [famousPerson, setFamousPerson] = useState<FamousPerson | null>(null);
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ratings, setRatings] = useState<{[key: string]: number}>({});
  const [flash, setFlash] = useState<{ questionId: string; label: string; id: number } | null>(null);

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
  }, [user, loading, id, router]);

  const loadFamousPerson = async () => {
    if (!user) return;
    try {
      const response = await fetch(`${TMDB_BASE_URL}/person/${id}?api_key=${TMDB_API_KEY}&language=en-US`);
      if (!response.ok) throw new Error('Failed to fetch from TMDB API');
      const personData: TMDBPerson = await response.json();
      const stats = await getFamousPersonStats(id);
      const rated = await hasUserRatedFamousPerson(user.uid, id);
      setAlreadyRated(rated);
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
    if (totalPoints === 0) {
      setError('Give at least one non-neutral rating before submitting.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      // Each person gets up to 10,000 points (±10,000). No global pool.
      await submitFamousPersonRating(user, famousPerson.id, famousPerson.name, totalPoints, undefined);
      setSuccess('Appreciation shared!');
      setTimeout(() => router.push('/leaderboard?tab=famous'), 1500);
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
  const canSubmit = totalGiven !== 0;
  const barPosition = Math.max(0, Math.min(100, ((totalGiven + POINTS_PER_PERSON) / (POINTS_PER_PERSON * 2)) * 100));
  const isPositive = totalGiven >= 0;
  const fillWidth = Math.abs(barPosition - 50);

  if (alreadyRated && famousPerson) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        <Nav showBack backHref="/leaderboard" />
        <main className="max-w-xl mx-auto px-5 py-10 text-center">
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-8 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Already rated</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              You&apos;ve already rated {famousPerson.name}. You can only rate each person once.
            </p>
            <Link
              href="/leaderboard"
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
        <div className="text-center text-gray-900 dark:text-gray-100 mb-4">
          <h1 className="text-xl font-bold">Share what you appreciate</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Give aura to this famous person</p>
        </div>

        {/* Person Info */}
        <div className="border border-gray-200 dark:border-gray-800 rounded-md p-4 mb-6">
          <div className="flex items-center gap-4 mb-4">
            {famousPerson.imageUrl ? (
              <Image
                src={famousPerson.imageUrl}
                alt={famousPerson.name}
                width={64}
                height={64}
                className="w-16 h-16 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                <svg className="h-8 w-8 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
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
          <div className="text-center">
            <Link
              href="/leaderboard"
              className="inline-block px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-md hover:opacity-90 text-sm font-medium"
            >
              View on leaderboard
            </Link>
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
                  <div className="flex-shrink-0 sm:w-28 text-center sm:text-left">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{q.question}</span>
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
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !canSubmit}
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
