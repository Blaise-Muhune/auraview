'use client';

import { useAuth } from "@/hooks/useAuth";
import { Nav } from "@/components/Nav";
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
        // Check if there's a pending group code to join
        const pendingGroupCode = localStorage.getItem('pendingGroupCode');
        
        if (pendingGroupCode) {
          // Clear the pending group code and redirect to join the group
          localStorage.removeItem('pendingGroupCode');
          router.push(`/join-group?code=${pendingGroupCode}`);
        } else {
          router.push('/dashboard');
        }
      }, 1500);
    } catch (err) {
      setError('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    // Check if there's a pending group code to join
    const pendingGroupCode = localStorage.getItem('pendingGroupCode');
    
    if (pendingGroupCode) {
      // Clear the pending group code and redirect to join the group
      localStorage.removeItem('pendingGroupCode');
      router.push(`/join-group?code=${pendingGroupCode}`);
    } else {
      router.push('/dashboard');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <span className="text-gray-500 dark:text-gray-400">Loading...</span>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Nav 
        rightContent={
          <button
            onClick={handleSkip}
            className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            Skip for Now
          </button>
        }
      />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center text-gray-900 dark:text-gray-100 mb-8">
            <h1 className="text-2xl font-bold mb-2">Complete your profile</h1>
            <p className="text-gray-600 dark:text-gray-400">Optional—add anytime</p>
          </div>

          {error && (
            <p className="mb-6 text-red-600 dark:text-red-400 text-sm">{error}</p>
          )}

          {success && (
            <p className="mb-6 text-green-600 dark:text-green-400 text-sm">
              {success}
            </p>
          )}

          {/* User Info */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-200 mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
              {user.photoURL && (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || 'User'} 
                  className="w-16 h-16 rounded-full"
                />
              )}
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{user.displayName || 'User'}</h2>
                <p className="text-gray-500 text-sm sm:text-base">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Social Handles */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-200 mb-8">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Social Handles (Optional)</h3>
            <p className="text-gray-600 mb-6 text-sm sm:text-base">Add your social media profiles to help others discover your aura</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">
                  Instagram
                </label>
                <input
                  type="text"
                  value={socialHandles.instagram}
                  onChange={(e) => handleSocialHandleChange('instagram', e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                  placeholder="@username"
                />
              </div>
              
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">
                  Twitter/X
                </label>
                <input
                  type="text"
                  value={socialHandles.twitter}
                  onChange={(e) => handleSocialHandleChange('twitter', e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                  placeholder="@username"
                />
              </div>
              
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">
                  LinkedIn
                </label>
                <input
                  type="text"
                  value={socialHandles.linkedin}
                  onChange={(e) => handleSocialHandleChange('linkedin', e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                  placeholder="Profile URL or username"
                />
              </div>
              
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">
                  GitHub
                </label>
                <input
                  type="text"
                  value={socialHandles.github}
                  onChange={(e) => handleSocialHandleChange('github', e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                  placeholder="username"
                />
              </div>
              
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">
                  Website
                </label>
                <input
                  type="url"
                  value={socialHandles.website}
                  onChange={(e) => handleSocialHandleChange('website', e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                  placeholder="https://yourwebsite.com"
                />
              </div>
              
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">
                  Other
                </label>
                <input
                  type="text"
                  value={socialHandles.other}
                  onChange={(e) => handleSocialHandleChange('other', e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                  placeholder="Other social platform"
                />
              </div>
            </div>
          </div>

          {/* Aura Sources */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-200 mb-8">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Aura Sources (Optional)</h3>
            <p className="text-gray-600 mb-6 text-sm sm:text-base">Share what makes your aura unique to help others understand you better</p>
            
            <div className="mb-6">
              <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">
                Aura Description
              </label>
              <textarea
                value={auraSources.description}
                onChange={(e) => handleAuraSourceChange('description', e.target.value)}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                rows={4}
                placeholder="Describe your aura, personality, achievements, or what makes you unique..."
              />
            </div>

            {/* Links */}
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <label className="block text-gray-700 font-medium text-sm sm:text-base">
                  Relevant Links
                </label>
                <button
                  onClick={() => addArrayItem('links')}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
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
                    className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                    placeholder="https://example.com"
                  />
                  <button
                    onClick={() => removeArrayItem('links', index)}
                    className="px-3 py-2 sm:py-3 text-red-500 hover:text-red-700 text-lg"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Achievements */}
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <label className="block text-gray-700 font-medium text-sm sm:text-base">
                  Achievements
                </label>
                <button
                  onClick={() => addArrayItem('achievements')}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
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
                    className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                    placeholder="e.g., Won coding competition, Published research paper..."
                  />
                  <button
                    onClick={() => removeArrayItem('achievements', index)}
                    className="px-3 py-2 sm:py-3 text-red-500 hover:text-red-700 text-lg"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Testimonials */}
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <label className="block text-gray-700 font-medium text-sm sm:text-base">
                  Testimonials
                </label>
                <button
                  onClick={() => addArrayItem('testimonials')}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Add Testimonial
                </button>
              </div>
              {auraSources.testimonials.map((testimonial, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <textarea
                    value={testimonial}
                    onChange={(e) => updateArrayItem('testimonials', index, e.target.value)}
                    className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                    rows={2}
                    placeholder="What others say about you..."
                  />
                  <button
                    onClick={() => removeArrayItem('testimonials', index)}
                    className="px-3 py-2 sm:py-3 text-red-500 hover:text-red-700 text-lg"
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
              className="px-6 sm:px-8 py-3 sm:py-4 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 font-semibold text-base sm:text-lg hover:bg-gray-200 transition-all shadow-sm"
            >
              Skip for Now
            </button>
            
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 sm:px-8 py-3 sm:py-4 bg-blue-600 rounded-lg text-white font-semibold text-base sm:text-lg hover:bg-blue-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving Profile...
                </span>
              ) : (
                'Save & Continue'
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
} 