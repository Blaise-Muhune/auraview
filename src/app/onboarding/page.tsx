'use client';

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { updateUserProfile, ensureUserProfile } from "@/lib/firestore";

export default function OnboardingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [socialHandles, setSocialHandles] = useState({
    instagram: '',
    twitter: '',
    linkedin: '',
    github: '',
    website: '',
    other: ''
  });
  const [auraSources, setAuraSources] = useState({
    description: '',
    links: [''],
    achievements: [''],
    testimonials: ['']
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      // Ensure user profile exists
      ensureUserProfile(user);
    }
  }, [user, loading, router]);

  const handleSocialHandleChange = (platform: string, value: string) => {
    setSocialHandles(prev => ({
      ...prev,
      [platform]: value
    }));
  };

  const handleAuraSourceChange = (field: string, value: string | string[]) => {
    setAuraSources(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addArrayItem = (field: 'links' | 'achievements' | 'testimonials') => {
    setAuraSources(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }));
  };

  const removeArrayItem = (field: 'links' | 'achievements' | 'testimonials', index: number) => {
    setAuraSources(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  const updateArrayItem = (field: 'links' | 'achievements' | 'testimonials', index: number, value: string) => {
    setAuraSources(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }));
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Filter out empty social handles
      const filteredSocialHandles = Object.fromEntries(
        Object.entries(socialHandles).filter(([_, value]) => value.trim() !== '')
      );

      // Filter out empty arrays and items
      const filteredAuraSources = {
        description: auraSources.description.trim(),
        links: auraSources.links.filter(link => link.trim() !== ''),
        achievements: auraSources.achievements.filter(achievement => achievement.trim() !== ''),
        testimonials: auraSources.testimonials.filter(testimonial => testimonial.trim() !== '')
      };

      await updateUserProfile(user.uid, {
        socialHandles: filteredSocialHandles,
        auraSources: filteredAuraSources
      });

      setSuccess('Profile updated successfully!');
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (err) {
      setError('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    router.push('/dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 mystical-bg relative overflow-hidden flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 mystical-text">✧</div>
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 mystical-bg relative overflow-hidden">
      {/* Simple mystical particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 text-purple-400/20 text-2xl float">✦</div>
        <div className="absolute top-40 right-20 text-cyan-400/20 text-xl float" style={{animationDelay: '1s'}}>✧</div>
        <div className="absolute bottom-40 left-20 text-emerald-400/20 text-3xl float" style={{animationDelay: '2s'}}>❋</div>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex justify-between items-center p-6 text-gray-700">
        <Link href="/" className="text-2xl font-bold mystical-text">✧ Aura ✧</Link>
        <div className="flex gap-4">
          <button
            onClick={handleSkip}
            className="px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 hover:border-gray-300 text-gray-600"
          >
            Skip for Now
          </button>
        </div>
      </nav>

      {/* Onboarding Content */}
      <main className="relative z-10 container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center text-gray-700 mb-8">
            <div className="text-4xl mb-4 mystical-text font-bold">✧ Welcome to Aura! ✧</div>
            <p className="text-gray-600 text-lg">Let&apos;s set up your profile to help others discover your aura</p>
            <p className="text-gray-500 text-sm mt-2">This is optional - you can skip and add these later</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
              {success}
            </div>
          )}

          {/* User Info */}
          <div className="bg-white rounded-xl p-8 shadow-lg border border-gray-100 mb-8">
            <div className="flex items-center gap-4 mb-6">
              {user.photoURL && (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || 'User'} 
                  className="w-16 h-16 rounded-full"
                />
              )}
              <div>
                <h2 className="text-2xl font-bold text-gray-700">{user.displayName || 'User'}</h2>
                <p className="text-gray-500">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Social Handles */}
          <div className="bg-white rounded-xl p-8 shadow-lg border border-gray-100 mb-8">
            <h3 className="text-xl font-semibold text-gray-700 mb-6 mystical-text">✧ Social Handles (Optional) ✧</h3>
            <p className="text-gray-600 mb-6">Add your social media profiles to help others discover your aura</p>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-700 font-medium mb-2">
                  <span className="text-purple-500">✦</span> Instagram
                </label>
                <input
                  type="text"
                  value={socialHandles.instagram}
                  onChange={(e) => handleSocialHandleChange('instagram', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-purple-400 focus:bg-white transition-colors"
                  placeholder="@username"
                />
              </div>
              
              <div>
                <label className="block text-gray-700 font-medium mb-2">
                  <span className="text-cyan-500">✦</span> Twitter/X
                </label>
                <input
                  type="text"
                  value={socialHandles.twitter}
                  onChange={(e) => handleSocialHandleChange('twitter', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-cyan-400 focus:bg-white transition-colors"
                  placeholder="@username"
                />
              </div>
              
              <div>
                <label className="block text-gray-700 font-medium mb-2">
                  <span className="text-blue-500">✦</span> LinkedIn
                </label>
                <input
                  type="text"
                  value={socialHandles.linkedin}
                  onChange={(e) => handleSocialHandleChange('linkedin', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
                  placeholder="Profile URL or username"
                />
              </div>
              
              <div>
                <label className="block text-gray-700 font-medium mb-2">
                  <span className="text-green-500">✦</span> GitHub
                </label>
                <input
                  type="text"
                  value={socialHandles.github}
                  onChange={(e) => handleSocialHandleChange('github', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-green-400 focus:bg-white transition-colors"
                  placeholder="username"
                />
              </div>
              
              <div>
                <label className="block text-gray-700 font-medium mb-2">
                  <span className="text-orange-500">✦</span> Website
                </label>
                <input
                  type="url"
                  value={socialHandles.website}
                  onChange={(e) => handleSocialHandleChange('website', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-orange-400 focus:bg-white transition-colors"
                  placeholder="https://yourwebsite.com"
                />
              </div>
              
              <div>
                <label className="block text-gray-700 font-medium mb-2">
                  <span className="text-purple-500">✦</span> Other
                </label>
                <input
                  type="text"
                  value={socialHandles.other}
                  onChange={(e) => handleSocialHandleChange('other', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-purple-400 focus:bg-white transition-colors"
                  placeholder="Other social platform"
                />
              </div>
            </div>
          </div>

          {/* Aura Sources */}
          <div className="bg-white rounded-xl p-8 shadow-lg border border-gray-100 mb-8">
            <h3 className="text-xl font-semibold text-gray-700 mb-6 mystical-text">✧ Aura Sources (Optional) ✧</h3>
            <p className="text-gray-600 mb-6">Share what makes your aura unique to help others understand you better</p>
            
            <div className="mb-6">
              <label className="block text-gray-700 font-medium mb-2">
                <span className="text-purple-500">✦</span> Aura Description
              </label>
              <textarea
                value={auraSources.description}
                onChange={(e) => handleAuraSourceChange('description', e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-purple-400 focus:bg-white transition-colors"
                rows={4}
                placeholder="Describe your aura, personality, achievements, or what makes you unique..."
              />
            </div>

            {/* Links */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-gray-700 font-medium">
                  <span className="text-cyan-500">✦</span> Relevant Links
                </label>
                <button
                  onClick={() => addArrayItem('links')}
                  className="text-sm text-purple-600 hover:text-purple-700"
                >
                  + Add Link
                </button>
              </div>
              {auraSources.links.map((link, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="url"
                    value={link}
                    onChange={(e) => updateArrayItem('links', index, e.target.value)}
                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-cyan-400 focus:bg-white transition-colors"
                    placeholder="https://example.com"
                  />
                  <button
                    onClick={() => removeArrayItem('links', index)}
                    className="px-3 py-3 text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Achievements */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-gray-700 font-medium">
                  <span className="text-green-500">✦</span> Achievements
                </label>
                <button
                  onClick={() => addArrayItem('achievements')}
                  className="text-sm text-purple-600 hover:text-purple-700"
                >
                  + Add Achievement
                </button>
              </div>
              {auraSources.achievements.map((achievement, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={achievement}
                    onChange={(e) => updateArrayItem('achievements', index, e.target.value)}
                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-green-400 focus:bg-white transition-colors"
                    placeholder="e.g., Won coding competition, Published research paper..."
                  />
                  <button
                    onClick={() => removeArrayItem('achievements', index)}
                    className="px-3 py-3 text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Testimonials */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-gray-700 font-medium">
                  <span className="text-orange-500">✦</span> Testimonials
                </label>
                <button
                  onClick={() => addArrayItem('testimonials')}
                  className="text-sm text-purple-600 hover:text-purple-700"
                >
                  + Add Testimonial
                </button>
              </div>
              {auraSources.testimonials.map((testimonial, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <textarea
                    value={testimonial}
                    onChange={(e) => updateArrayItem('testimonials', index, e.target.value)}
                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-orange-400 focus:bg-white transition-colors"
                    rows={2}
                    placeholder="What others say about you..."
                  />
                  <button
                    onClick={() => removeArrayItem('testimonials', index)}
                    className="px-3 py-3 text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleSkip}
              className="px-8 py-4 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 font-semibold text-lg hover:bg-gray-200 transition-all shadow-lg"
            >
              Skip for Now
            </button>
            
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-8 py-4 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-lg text-white font-semibold text-lg hover:from-purple-600 hover:to-cyan-600 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving Profile...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span className="text-purple-200">✧</span>
                  Save & Continue
                  <span className="text-cyan-200">✧</span>
                </span>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
} 