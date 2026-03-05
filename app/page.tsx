import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-950 via-gray-900 to-black p-8 text-white">
      <div className="flex flex-col items-center gap-8 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight md:text-7xl">
          LOGIK <span className="text-blue-400">GAME</span>
        </h1>
        <p className="max-w-md text-lg text-gray-400">
          Jeu de logique interactif en temps réel 
        </p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/admin/login"
            className="rounded-xl bg-blue-600 px-8 py-3 text-lg font-semibold transition-colors hover:bg-blue-700"
          >
            Administration
          </Link>
          <Link
            href="/player/register"
            className="rounded-xl border border-gray-600 px-8 py-3 text-lg font-semibold transition-colors hover:bg-gray-800"
          >
            Joueur
          </Link>
          <Link
            href="/projection/auth"
            className="rounded-xl border border-gray-600 px-8 py-3 text-lg font-semibold transition-colors hover:bg-gray-800"
          >
            Projection
          </Link>
        </div>
      </div>
    </div>
  );
}
