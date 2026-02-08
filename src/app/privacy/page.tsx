'use client';

import Link from "next/link";
import { Nav } from "@/components/Nav";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Nav showBack backHref="/" />

      <main className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-8">Privacy Policy</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Last updated: {new Date().toLocaleDateString('en-US')}</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">1. What We Collect</h2>
            <p>When you use Aura, we collect:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Account data:</strong> Email, display name, and profile photo from Google</li>
              <li><strong>Ratings:</strong> Points you give or receive, optional reasons you write</li>
              <li><strong>Group data:</strong> Groups you create or join, participant lists</li>
              <li><strong>Profile info:</strong> Social handles, aura sources, and other details you add</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">2. How We Use It</h2>
            <p>We use your data to run the service: show rankings, display profiles, let friends rate each other, and enable group features. We don&apos;t sell your data.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">3. What&apos;s Public</h2>
            <p>Your profile can be viewed by anyone with the link. Display name, total aura, and ranking are visible on public leaderboards. Ratings you give and receive are stored and shown within the groups you participate in.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">4. Third-Party Services</h2>
            <p>We use Firebase (Google) for auth and database. Google&apos;s privacy policy applies to your sign-in. For famous people rankings, we use The Movie Database (TMDB) API to fetch names and images.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">5. Data Retention</h2>
            <p>We keep your data while your account is active. If you delete your account, we&apos;ll remove your profile data. Some data (e.g. ratings in groups) may remain for the integrity of group results.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">6. Your Rights</h2>
            <p>You can update your profile and social handles in the app. You can leave groups. If you want to delete your account or data, contact us.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">7. Children</h2>
            <p>Aura is not intended for users under 13. We don&apos;t knowingly collect data from children under 13.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">8. Changes</h2>
            <p>We may update this policy. We&apos;ll post changes here and note the date. Continued use means you accept the updated policy.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">9. Contact</h2>
            <p>Questions about privacy? Reach out via the app.</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
          <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">Back to home</Link>
        </div>
      </main>
    </div>
  );
}
