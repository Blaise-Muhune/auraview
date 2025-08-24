import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
      {/* Simple mystical particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 text-purple-400/20 text-2xl float">✦</div>
        <div className="absolute top-40 right-20 text-cyan-400/20 text-xl float" style={{animationDelay: '1s'}}>✧</div>
        <div className="absolute bottom-40 left-20 text-emerald-400/20 text-3xl float" style={{animationDelay: '2s'}}>❋</div>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex justify-between items-center p-6 text-gray-700">
        <div className="flex items-center gap-3">
          <Image 
            src="/logo.png" 
            alt="Aura Logo" 
            width={40} 
            height={40} 
            className="rounded-lg"
          />
          <span className="text-2xl font-bold text-gray-900">Aura</span>
        </div>
        <div className="flex gap-4">
          <Link href="/login" className="px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 hover:border-blue-300">
            Login
          </Link>
          <Link href="/signup" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-lg">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Simple Hero Section */}
      <main className="relative z-10 container mx-auto px-6 py-20">
        <div className="text-center text-gray-700 mb-16">
          <div className="mb-8">
            <div className="flex justify-center mb-6">
              <Image 
                src="/logo.png" 
                alt="Aura Logo" 
                width={120} 
                height={120} 
                className="rounded-2xl shadow-lg"
              />
            </div>
            <div className="text-6xl mb-4 text-gray-900 font-bold">Aura</div>
            <div className="text-2xl text-gray-600 mb-2">Rate Your Friends</div>
          </div>
          
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Give 10,000 points to your friends based on their personality, achievements, and character.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link href="/signup" className="px-8 py-4 bg-blue-600 rounded-lg text-white font-semibold text-lg hover:bg-blue-700 transition-all shadow-lg">
              Start Ranking
            </Link>
            <Link href="/leaderboard" className="px-8 py-4 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold text-lg hover:border-blue-400 hover:bg-blue-50 transition-all">
              View Rankings
            </Link>
          </div>

          {/* Simple stats */}
          <div className="grid grid-cols-3 gap-8 max-w-xl mx-auto">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">10,000</div>
              <div className="text-gray-500 text-sm">Points</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">500</div>
              <div className="text-gray-500 text-sm">Base</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">∞</div>
              <div className="text-gray-500 text-sm">Possibilities</div>
            </div>
          </div>
        </div>

        {/* Simple CTA */}
        <div className="text-center text-gray-700">
          <Link href="/signup" className="inline-block px-10 py-4 bg-blue-600 rounded-lg text-white font-semibold text-xl hover:bg-blue-700 transition-all shadow-lg">
            Create Your Account
          </Link>
        </div>
      </main>

      {/* Simple Footer */}
      <footer className="relative z-10 border-t border-gray-200 mt-20 bg-white">
        <div className="container mx-auto px-6 py-8">
          <div className="text-center text-gray-500">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Image 
                src="/logo.png" 
                alt="Aura Logo" 
                width={32} 
                height={32} 
                className="rounded-lg"
              />
              <span className="text-lg font-semibold text-gray-900">Aura</span>
            </div>
            <p className="text-sm">Rate your friends&apos; aura and build meaningful connections</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
