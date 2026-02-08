'use client';

import Link from "next/link";
import { Nav } from "@/components/Nav";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Nav showBack backHref="/" />

      <main className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-8">Terms of Service</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Last updated: {new Date().toLocaleDateString('en-US')}</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">1. Acceptance</h2>
            <p>By signing up or using Aura, you agree to these Terms of Service and our Privacy Policy. If you don&apos;t agree, don&apos;t use the service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">2. The Service</h2>
            <p>Aura lets you create groups, give and receive ratings (aura points) from friends, share public profiles, and view rankings. Features may change over time.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">3. Your Account</h2>
            <p>You sign in with Google. You&apos;re responsible for keeping your account secure. Don&apos;t share access. You must be at least 13 to use Aura.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">4. Your Conduct</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Harass, bully, or abuse others</li>
              <li>Impersonate anyone or misrepresent yourself</li>
              <li>Post false, defamatory, or illegal content</li>
              <li>Spam, scrape, or automate access</li>
              <li>Try to manipulate ratings or rankings</li>
            </ul>
            <p className="mt-2">We may suspend or remove accounts that violate these rules.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">5. Content You Create</h2>
            <p>Ratings, display names, and profile info are yours. You give us a license to store, display, and process them to run the service. Your public profile and rankings can be seen by anyone with the link.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">6. Intellectual Property</h2>
            <p>Aura, the logo, and the app design are owned by us. You may not copy or reuse them without permission.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">7. Limitation of Liability</h2>
            <p>Aura is provided &quot;as is.&quot; We don&apos;t guarantee it will be error-free or uninterrupted. We&apos;re not liable for indirect, incidental, or consequential damages arising from your use of the service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">8. Changes</h2>
            <p>We may update these terms. Continued use after changes means you accept them. We&apos;ll try to notify you of material changes.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">9. Contact</h2>
            <p>Questions? Reach out via the app or the contact method listed in the app.</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
          <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">Back to home</Link>
        </div>
      </main>
    </div>
  );
}
