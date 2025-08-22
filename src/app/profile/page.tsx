'use client';

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getUserProfile, updateUserProfile, UserProfile, ensureUserProfile } from "@/lib/firestore";

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
      loadProfile();
    }
  }, [user, loading, router]);

  const loadProfile = async () => {
    if (!user) return;
    
    try {
      // Ensure user profile exists, create if it doesn't
      const userProfile = await ensureUserProfile(user);
      setProfile(userProfile);
      setSocialHandles({
        instagram: userProfile.socialHandles?.instagram || '',
        twitter: userProfile.socialHandles?.twitter || '',
        linkedin: userProfile.socialHandles?.linkedin || '',
        github: userProfile.socialHandles?.github || '',
        website: userProfile.socialHandles?.website || '',
        other: userProfile.socialHandles?.other || ''
      });
      setAuraSources({
        description: userProfile.auraSources?.description || '',
        links: userProfile.auraSources?.links || [''],
        achievements: userProfile.auraSources?.achievements || [''],
        testimonials: userProfile.auraSources?.testimonials || ['']
      });
    } catch (err) {
      setError('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

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
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-600 text-lg">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="text-2xl font-bold text-gray-900">Aura</Link>
            <div className="flex items-center gap-4">
              {user && (
                <div className="flex items-center gap-3">
                  {user.photoURL && (
                    <img 
                      src={user.photoURL} 
                      alt={user.displayName || 'User'} 
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <span className="text-sm text-gray-600">
                    {user.displayName || 'User'}
                  </span>
                </div>
              )}
              <Link href="/dashboard" className="px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 hover:border-gray-300 text-gray-700">
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Profile Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center text-gray-900 mb-12">
            <h1 className="text-4xl font-bold mb-4">Your Aura Profile</h1>
            <p className="text-xl text-gray-600">Share your social presence and sources to help others judge your aura</p>
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
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
            <div className="flex items-center gap-4 mb-6">
              {user.photoURL && (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || 'User'} 
                  className="w-16 h-16 rounded-full"
                />
              )}
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{user.displayName || 'User'}</h2>
                <p className="text-gray-600">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Social Handles */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Social Handles</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-900 font-medium mb-2">
                  Instagram
                </label>
                <input
                  type="text"
                  value={socialHandles.instagram}
                  onChange={(e) => handleSocialHandleChange('instagram', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors"
                  placeholder="@username"
                />
              </div>
              
              <div>
                <label className="block text-gray-900 font-medium mb-2">
                  Twitter/X
                </label>
                <input
                  type="text"
                  value={socialHandles.twitter}
                  onChange={(e) => handleSocialHandleChange('twitter', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors"
                  placeholder="@username"
                />
              </div>
              
              <div>
                <label className="block text-gray-900 font-medium mb-2">
                  LinkedIn
                </label>
                <input
                  type="text"
                  value={socialHandles.linkedin}
                  onChange={(e) => handleSocialHandleChange('linkedin', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors"
                  placeholder="Profile URL or username"
                />
              </div>
              
              <div>
                <label className="block text-gray-900 font-medium mb-2">
                  GitHub
                </label>
                <input
                  type="text"
                  value={socialHandles.github}
                  onChange={(e) => handleSocialHandleChange('github', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors"
                  placeholder="username"
                />
              </div>
              
              <div>
                <label className="block text-gray-900 font-medium mb-2">
                  Website
                </label>
                <input
                  type="url"
                  value={socialHandles.website}
                  onChange={(e) => handleSocialHandleChange('website', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors"
                  placeholder="https://yourwebsite.com"
                />
              </div>
              
              <div>
                <label className="block text-gray-900 font-medium mb-2">
                  Other
                </label>
                <input
                  type="text"
                  value={socialHandles.other}
                  onChange={(e) => handleSocialHandleChange('other', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors"
                  placeholder="Other social platform"
                />
              </div>
            </div>
          </div>

          {/* Aura Sources */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Aura Sources</h3>
            
            <div className="mb-6">
              <label className="block text-gray-900 font-medium mb-2">
                Aura Description
              </label>
              <textarea
                value={auraSources.description}
                onChange={(e) => handleAuraSourceChange('description', e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors"
                rows={4}
                placeholder="Describe your aura, personality, achievements, or what makes you unique..."
              />
            </div>

            {/* Links */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-gray-900 font-medium">
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
                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors"
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
                <label className="block text-gray-900 font-medium">
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
                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors"
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
                <label className="block text-gray-900 font-medium">
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
                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors"
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

          {/* Save Button */}
          <div className="text-center">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-8 py-4 bg-blue-600 rounded-lg text-white font-semibold text-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving Profile...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Save Profile
                </span>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
} 